import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { getGeneratedProvider } from "./helpers/prisma-provider";

// SQLite database integration test for LOCAL development. Uses a dedicated file
// so the dev database is never touched, and applies migrations via
// `prisma migrate deploy`. Gates on the generated client so it only runs when the
// SQLite client is generated (`npm test`); the PostgreSQL equivalent lives in
// tests/db.postgres.test.ts and runs under `npm run test:postgres`.

const TEST_DB_REL = "data/test-domain-radar.db";
const TEST_DB_ABS = path.resolve(process.cwd(), TEST_DB_REL);
const TEST_URL = `file:../${TEST_DB_REL.replace(/\\/g, "/")}`;

const provider = getGeneratedProvider();
if (provider !== "sqlite") {
  console.warn(
    `[db.test] skipped: generated Prisma client is "${provider}", expected "sqlite". ` +
      "Run `npm test` (regenerates the SQLite client) or see tests/db.postgres.test.ts.",
  );
}

let prisma: PrismaClient;

describe.skipIf(provider !== "sqlite")("database migrations & constraints (SQLite)", () => {
  beforeAll(() => {
    if (existsSync(TEST_DB_ABS)) rmSync(TEST_DB_ABS, { force: true });
    execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: TEST_URL },
    });
    prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (existsSync(TEST_DB_ABS)) rmSync(TEST_DB_ABS, { force: true });
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
});
