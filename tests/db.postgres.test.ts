import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { getGeneratedProvider } from "./helpers/prisma-provider";

// PostgreSQL database integration test. This is the production parity check: it
// proves the generated prisma/postgres/schema.prisma applies cleanly to a real
// PostgreSQL server and enforces the same constraints as the SQLite test.
//
// Run it with the PostgreSQL client generated and a real URL:
//   TEST_DATABASE_URL="postgres://..." npm run test:postgres
//
// The URL is forced into a dedicated `domain_radar_test` schema (unless it
// already pins a schema) so the public schema of the target database — including
// production — is never touched. Rows created here are cleaned up.

const provider = getGeneratedProvider();
const rawUrl = process.env.TEST_DATABASE_URL?.trim() ?? "";

if (provider !== "postgresql") {
  console.warn(
    `[db.postgres.test] skipped: generated Prisma client is "${provider}", expected ` +
      '"postgresql". Run `npm run test:postgres`.',
  );
} else if (!rawUrl) {
  console.warn(
    "[db.postgres.test] skipped: TEST_DATABASE_URL is not set. Point it at a " +
      "PostgreSQL server; the test uses an isolated `domain_radar_test` schema.",
  );
}

const TEST_URL = (() => {
  if (!rawUrl) return "";
  return /[?&]schema=/.test(rawUrl)
    ? rawUrl
    : `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}schema=domain_radar_test`;
})();

let prisma: PrismaClient;

async function cleanTestRows(client: PrismaClient) {
  await client.domainVariantCheck.deleteMany({
    where: { fqdn: { in: ["agentcapability.si"] } },
  });
  await client.availabilityCheck.deleteMany({ where: { fqdn: "foo.cz" } });
  await client.domainCandidate.deleteMany({
    where: { fqdn: { in: ["agentcapability.ex", "foo.cz"] } },
  });
  await client.domainSearchSession.deleteMany({
    where: { normalizedSld: "agentcapability" },
  });
  await client.source.deleteMany({
    where: { key: { in: ["test_source_1", "rdap_register_si_test"] } },
  });
  await client.tldRegistry.deleteMany({
    where: { tld: { in: [".test", ".ex", ".cz", ".si"] } },
  });
  await client.userSettings.deleteMany({ where: { id: "singleton" } });
}

describe.skipIf(provider !== "postgresql" || !TEST_URL)(
  "database migrations & constraints (PostgreSQL)",
  () => {
    beforeAll(async () => {
      execSync("npx prisma migrate deploy --schema=prisma/postgres/schema.prisma", {
        stdio: "pipe",
        env: { ...process.env, DATABASE_URL: TEST_URL },
      });
      prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
      await cleanTestRows(prisma);
    });

    afterAll(async () => {
      await cleanTestRows(prisma);
      await prisma.$disconnect();
    });

    it("creates the TldRegistry table and enforces unique tld", async () => {
      await prisma.tldRegistry.create({
        data: { tld: ".test", displayName: "Test", status: "AVAILABLE" },
      });
      await expect(
        prisma.tldRegistry.create({
          data: { tld: ".test", displayName: "Dup", status: "AVAILABLE" },
        }),
      ).rejects.toThrow();
    });

    it("enforces unique fqdn on DomainCandidate and supports CRUD", async () => {
      const tld = await prisma.tldRegistry.create({
        data: { tld: ".ex", displayName: "Ex", status: "AVAILABLE" },
      });
      const created = await prisma.domainCandidate.create({
        data: {
          fqdn: "agentcapability.ex",
          sld: "agentcapability",
          tld: ".ex",
          tldId: tld.id,
        },
      });
      expect(created.status).toBe("CANDIDATE");

      const read = await prisma.domainCandidate.findUnique({
        where: { fqdn: "agentcapability.ex" },
      });
      expect(read?.id).toBe(created.id);

      await expect(
        prisma.domainCandidate.create({
          data: {
            fqdn: "agentcapability.ex",
            sld: "agentcapability",
            tld: ".ex",
            tldId: tld.id,
          },
        }),
      ).rejects.toThrow();

      await prisma.domainCandidate.update({
        where: { id: created.id },
        data: { status: "SHORTLISTED" },
      });
      const updated = await prisma.domainCandidate.findUnique({
        where: { id: created.id },
      });
      expect(updated?.status).toBe("SHORTLISTED");
    });

    it("cascades AvailabilityCheck on candidate delete", async () => {
      const tld = await prisma.tldRegistry.create({
        data: { tld: ".cz", displayName: "Cz", status: "AVAILABLE" },
      });
      const source = await prisma.source.create({
        data: { key: "test_source_1", name: "Test", kind: "RDAP", status: "AVAILABLE" },
      });
      const cand = await prisma.domainCandidate.create({
        data: { fqdn: "foo.cz", sld: "foo", tld: ".cz", tldId: tld.id },
      });
      await prisma.availabilityCheck.create({
        data: {
          candidateId: cand.id,
          sourceId: source.id,
          tld: ".cz",
          fqdn: "foo.cz",
          normalizedStatus: "NOT_FOUND",
        },
      });
      await prisma.domainCandidate.delete({ where: { id: cand.id } });
      const remaining = await prisma.availabilityCheck.findMany({
        where: { candidateId: cand.id },
      });
      expect(remaining).toHaveLength(0);
    });

    it("records a DomainSearchSession with variant counts", async () => {
      const session = await prisma.domainSearchSession.create({
        data: {
          rawQuery: "AgentCapability",
          normalizedSld: "agentcapability",
          requestedTlds: JSON.stringify([".com", ".ai", ".si", ".co"]),
          requestedCount: 4,
          unsupportedCount: 1,
          status: "PENDING",
        },
      });
      expect(session.id).toBeTruthy();
      const found = await prisma.domainSearchSession.findUnique({
        where: { id: session.id },
      });
      expect(JSON.parse(found!.requestedTlds)).toContain(".si");
    });

    it("stores multi-TLD variant checks linked to a session and TLD", async () => {
      const tld = await prisma.tldRegistry.create({
        data: { tld: ".si", displayName: "Si", status: "AVAILABLE" },
      });
      const source = await prisma.source.create({
        data: {
          key: "rdap_register_si_test",
          name: "Register.si RDAP",
          kind: "RDAP",
          status: "AVAILABLE",
        },
      });
      const session = await prisma.domainSearchSession.create({
        data: {
          rawQuery: "agentcapability",
          normalizedSld: "agentcapability",
          requestedTlds: JSON.stringify([".si"]),
          requestedCount: 1,
        },
      });
      const check = await prisma.domainVariantCheck.create({
        data: {
          sessionId: session.id,
          sourceId: source.id,
          tldId: tld.id,
          fqdn: "agentcapability.si",
          httpStatus: 404,
          normalizedStatus: "NOT_FOUND",
        },
      });
      expect(check.id).toBeTruthy();
      const rel = await prisma.domainVariantCheck.findUnique({
        where: { id: check.id },
        include: { session: true, tld: true },
      });
      expect(rel?.session?.id).toBe(session.id);
      expect(rel?.tld.tld).toBe(".si");
    });

    it("persists a singleton UserSettings row", async () => {
      await prisma.userSettings.create({
        data: {
          id: "singleton",
          defaultTlds: JSON.stringify([".com", ".ai", ".si"]),
        },
      });
      await expect(
        prisma.userSettings.create({
          data: { id: "singleton", defaultTlds: JSON.stringify([".com"]) },
        }),
      ).rejects.toThrow();
    });
  },
);
