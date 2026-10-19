import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import type { RdapOutcome } from "@/lib/rdap/types";
import { getGeneratedProvider } from "../helpers/prisma-provider";

// Engine integration test. Runs against a throwaway SQLite file and injects the
// engine's network seams so NO real RDAP request is made. Verifies the honest
// status semantics that matter for bulk scanning: unsupported extensions are
// SKIPPED (not attempted), definite answers are DONE, errors are FAILED, and the
// configured request budget stops outbound work rather than fabricating results.

const TEST_DB_REL = "data/test-engine.db";
const TEST_DB_ABS = path.resolve(process.cwd(), TEST_DB_REL);
const TEST_URL = `file:../${TEST_DB_REL.replace(/\\/g, "/")}`;

const provider = getGeneratedProvider();

type JobRepo = typeof import("@/lib/jobs/repository").jobRepository;
type RunStep = typeof import("@/lib/jobs/engine").runJobStep;
type Prisma = import("@prisma/client").PrismaClient;

let jobRepository: JobRepo;
let runJobStep: RunStep;
let prisma: Prisma;

function outcome(
  fqdn: string,
  status: RdapOutcome["status"],
  extra: Partial<RdapOutcome> = {},
): RdapOutcome {
  return {
    fqdn,
    status,
    httpStatus: status === "REGISTERED" ? 200 : 404,
    rawStatus: null,
    errorKind: null,
    errorDetails: null,
    responseMs: 12,
    providerHost: "rdap.example.test",
    requestUrl: `https://rdap.example.test/domain/${fqdn}`,
    attempts: 1,
    retryAfterMs: null,
    ...extra,
  };
}

describe.skipIf(provider !== "sqlite")("batch engine (SQLite, injected network)", () => {
  beforeAll(async () => {
    if (existsSync(TEST_DB_ABS)) rmSync(TEST_DB_ABS, { force: true });
    execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: TEST_URL },
    });
    process.env.DATABASE_URL = TEST_URL;
    ({ jobRepository } = await import("@/lib/jobs/repository"));
    ({ runJobStep } = await import("@/lib/jobs/engine"));
    const { prisma: singleton } = await import("@/lib/db");
    prisma = singleton;

    await prisma.tldRegistry.createMany({
      data: [
        { tld: ".com", displayName: "Com", status: "AVAILABLE", rdapBaseUrl: "https://rdap.example.test/" },
        { tld: ".io", displayName: "Io", status: "AVAILABLE", rdapBaseUrl: "https://rdap.example.test/" },
        { tld: ".co", displayName: "Co", status: "UNSUPPORTED", rdapBaseUrl: null },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (existsSync(TEST_DB_ABS)) rmSync(TEST_DB_ABS, { force: true });
  });

  function makeDeps(overrides: {
    lookup?: (fqdn: string) => Promise<RdapOutcome>;
    budget?: number;
    delayMs?: number;
  } = {}) {
    const lookupCalls: string[] = [];
    const deps = {
      loadBootstrapMap: async () => null,
      lookup: async (fqdn: string) => {
        lookupCalls.push(fqdn);
        return overrides.lookup
          ? overrides.lookup(fqdn)
          : Promise.resolve(outcome(fqdn, "REGISTERED"));
      },
      loadTld: (tld: string) => prisma.tldRegistry.findUnique({ where: { tld } }),
      getSettings: async () => ({
        requestDelayMs: overrides.delayMs ?? 0,
        requestBudgetPerRun: overrides.budget ?? 0,
      }),
      countNetworkAttempts: (jobId: string) =>
        prisma.researchJobItem.count({ where: { jobId, attempts: { gt: 0 } } }),
      saveAudit: async () => {},
      findFreshCheck: async () => null,
      ensureSource: async (host: string) => ({
        id: `src:${host}`,
        name: `RDAP ${host}`,
        key: `key:${host}`,
        cacheTtlSeconds: 0,
        timeoutMs: 1000,
        maxRetries: 0,
        rateLimitPerMinute: null,
      }),
    };
    return { deps, lookupCalls };
  }

  async function makeJob(items: { sld: string; tld: string }[]) {
    const { id } = await jobRepository.create({
      rawInput: items.map((i) => `${i.sld}${i.tld}`).join("\n"),
      requestedTlds: Array.from(new Set(items.map((i) => i.tld))),
      items,
      maxItems: 1000,
      maxTlds: 20,
    });
    return id;
  }

  it("resolves registered domains as DONE and skips unsupported extensions", async () => {
    const id = await makeJob([
      { sld: "acme", tld: ".com" },
      { sld: "acme", tld: ".co" }, // unsupported
      { sld: "beta", tld: ".io" },
    ]);
    const { deps, lookupCalls } = makeDeps();
    const res = await runJobStep(id, { deps, maxItems: 10 });
    expect(res.hasMore).toBe(false);
    expect(res.status).toBe("COMPLETED");
    expect(lookupCalls.sort()).toEqual(["acme.com", "beta.io"]); // .co never attempted
    const { items } = await jobRepository.items(id);
    const byFqdn = Object.fromEntries(items.map((i) => [i.fqdn, i]));
    expect(byFqdn["acme.com"].status).toBe("DONE");
    expect(byFqdn["acme.com"].normalizedStatus).toBe("REGISTERED");
    expect(byFqdn["acme.co"].status).toBe("SKIPPED");
    expect(byFqdn["acme.co"].normalizedStatus).toBe("UNSUPPORTED");
  });

  it("records NOT_FOUND as DONE (registry state, never 'available')", async () => {
    const id = await makeJob([{ sld: "nope", tld: ".com" }]);
    const { deps } = makeDeps({
      lookup: async (fqdn) => outcome(fqdn, "NOT_FOUND"),
    });
    await runJobStep(id, { deps, maxItems: 10 });
    const { items } = await jobRepository.items(id);
    expect(items[0].status).toBe("DONE");
    expect(items[0].normalizedStatus).toBe("NOT_FOUND");
  });

  it("marks transport errors as FAILED with the error kind preserved", async () => {
    const id = await makeJob([{ sld: "boom", tld: ".com" }]);
    const { deps } = makeDeps({
      lookup: async (fqdn) =>
        outcome(fqdn, "ERROR", { errorKind: "NETWORK", errorDetails: "reset" }),
    });
    await runJobStep(id, { deps, maxItems: 10 });
    const { items } = await jobRepository.items(id);
    expect(items[0].status).toBe("FAILED");
    expect(items[0].errorKind).toBe("NETWORK");
  });

  it("processes only maxItems per step and reports hasMore", async () => {
    const id = await makeJob([
      { sld: "a", tld: ".com" },
      { sld: "b", tld: ".com" },
      { sld: "c", tld: ".com" },
      { sld: "d", tld: ".com" },
      { sld: "e", tld: ".com" },
    ]);
    const { deps, lookupCalls } = makeDeps();
    const first = await runJobStep(id, { deps, maxItems: 2 });
    expect(first.processed).toBe(2);
    expect(first.hasMore).toBe(true);
    expect(lookupCalls).toHaveLength(2);

    let guard = 0;
    let res = first;
    while (res.hasMore && guard++ < 10) {
      res = await runJobStep(id, { deps, maxItems: 2 });
    }
    expect(res.status).toBe("COMPLETED");
    expect(res.counts.doneCount).toBe(5);
  });

  it("enforces the per-run request budget instead of scanning unboundedly", async () => {
    const id = await makeJob([
      { sld: "a", tld: ".com" },
      { sld: "b", tld: ".com" },
      { sld: "c", tld: ".com" },
    ]);
    const { deps, lookupCalls } = makeDeps({ budget: 2 });
    await runJobStep(id, { deps, maxItems: 10 });
    expect(lookupCalls).toHaveLength(2); // budget respected
    const { items } = await jobRepository.items(id);
    const limited = items.filter((i) => i.normalizedStatus === "RATE_LIMITED");
    expect(limited.length).toBeGreaterThanOrEqual(1);
    expect(limited[0].errorKind).toBe("RATE_LIMITED");
  });

  it("resumes exactly where it left off after a partial step", async () => {
    const id = await makeJob([
      { sld: "a", tld: ".com" },
      { sld: "b", tld: ".com" },
      { sld: "c", tld: ".com" },
    ]);
    const { deps } = makeDeps();
    await runJobStep(id, { deps, maxItems: 1 });
    let mid = await jobRepository.get(id);
    expect(mid?.doneCount).toBe(1);
    expect(mid?.pendingCount).toBe(2);
    await runJobStep(id, { deps, maxItems: 10 });
    mid = await jobRepository.get(id);
    expect(mid?.doneCount).toBe(3);
    expect(mid?.pendingCount).toBe(0);
  });
});
