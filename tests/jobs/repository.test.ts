import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { getGeneratedProvider } from "../helpers/prisma-provider";

// Repository-level integration test for durable batch jobs. Runs against a
// throwaway SQLite file (never the dev DB) and only when the SQLite client is
// generated (i.e. under `npm test`). Exercises the lifecycle that the engine
// depends on: create -> claim(lease) -> take/finish -> recount -> cancel/retry.

const TEST_DB_REL = "data/test-jobs.db";
const TEST_DB_ABS = path.resolve(process.cwd(), TEST_DB_REL);
const TEST_URL = `file:../${TEST_DB_REL.replace(/\\/g, "/")}`;

const provider = getGeneratedProvider();

type JobRepo = typeof import("@/lib/jobs/repository").jobRepository;
type Prisma = import("@prisma/client").PrismaClient;

let jobRepository: JobRepo;
let prisma: Prisma;

describe.skipIf(provider !== "sqlite")("durable batch jobs (SQLite)", () => {
  beforeAll(async () => {
    if (existsSync(TEST_DB_ABS)) rmSync(TEST_DB_ABS, { force: true });
    execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: TEST_URL },
    });
    // Point the singleton Prisma client at the test DB BEFORE importing it.
    process.env.DATABASE_URL = TEST_URL;
    ({ jobRepository } = await import("@/lib/jobs/repository"));
    const { prisma: singleton } = await import("@/lib/db");
    prisma = singleton;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (existsSync(TEST_DB_ABS)) rmSync(TEST_DB_ABS, { force: true });
  });

  it("creates a job with pending items and zeroed counters", async () => {
    const { id } = await jobRepository.create({
      rawInput: "acme\nbeta",
      sourceLabel: "paste",
      requestedTlds: [".com", ".io"],
      items: [
        { sld: "acme", tld: ".com" },
        { sld: "acme", tld: ".io" },
        { sld: "beta", tld: ".com" },
        { sld: "beta", tld: ".io" },
      ],
      maxItems: 3000,
      maxTlds: 20,
    });
    const job = await jobRepository.get(id);
    expect(job?.status).toBe("PENDING");
    expect(job?.totalItems).toBe(4);
    expect(job?.pendingCount).toBe(4);
    const { items } = await jobRepository.items(id);
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.status === "PENDING")).toBe(true);
  });

  it("claims a job once; a concurrent claim is rejected", async () => {
    const { id } = await jobRepository.create({
      rawInput: "x.com",
      requestedTlds: [".com"],
      items: [{ sld: "x", tld: ".com" }],
      maxItems: 100,
      maxTlds: 20,
    });
    const first = await jobRepository.claim(id, "owner-1");
    expect(first).not.toBeNull();
    expect(first?.status).toBe("RUNNING");
    const second = await jobRepository.claim(id, "owner-2");
    expect(second).toBeNull();
    await jobRepository.releaseLease(id, "owner-1");
    const third = await jobRepository.claim(id, "owner-3");
    expect(third).not.toBeNull();
  });

  it("takes pending items, finishes them and recounts truthfully", async () => {
    const { id } = await jobRepository.create({
      rawInput: "a.com b.com c.com",
      requestedTlds: [".com"],
      items: [
        { sld: "a", tld: ".com" },
        { sld: "b", tld: ".com" },
        { sld: "c", tld: ".com" },
      ],
      maxItems: 100,
      maxTlds: 20,
    });
    const taken = await jobRepository.takePending(id, 2);
    expect(taken).toHaveLength(2);
    await jobRepository.finishItem(taken[0], {
      status: "DONE",
      normalizedStatus: "REGISTERED",
      isFresh: true,
      checkedAt: new Date(),
    });
    await jobRepository.finishItem(taken[1], {
      status: "FAILED",
      normalizedStatus: "ERROR",
      errorKind: "NETWORK",
      lastError: "boom",
    });
    const counts = await jobRepository.recount(id);
    expect(counts.totalItems).toBe(3);
    expect(counts.doneCount).toBe(1);
    expect(counts.failedCount).toBe(1);
    expect(counts.pendingCount).toBe(1);

    // Item attempts increment on finish.
    const { items } = await jobRepository.items(id);
    const done = items.find((i) => i.status === "DONE");
    expect(done?.attempts).toBe(1);
  });

  it("requeues failed items back to pending for retry", async () => {
    const { id } = await jobRepository.create({
      rawInput: "a.com",
      requestedTlds: [".com"],
      items: [{ sld: "a", tld: ".com" }],
      maxItems: 100,
      maxTlds: 20,
    });
    const [itemId] = await jobRepository.takePending(id, 1);
    await jobRepository.finishItem(itemId, {
      status: "FAILED",
      normalizedStatus: "ERROR",
    });
    const requeued = await jobRepository.requeueFailed(id);
    expect(requeued).toBe(1);
    const counts = await jobRepository.recount(id);
    expect(counts.pendingCount).toBe(1);
    expect(counts.failedCount).toBe(0);
    // attempts survived the requeue
    const { items } = await jobRepository.items(id);
    expect(items[0].attempts).toBe(1);
  });

  it("cancels a job: pending becomes skipped, job is CANCELLED", async () => {
    const { id } = await jobRepository.create({
      rawInput: "a.com b.com",
      requestedTlds: [".com"],
      items: [
        { sld: "a", tld: ".com" },
        { sld: "b", tld: ".com" },
      ],
      maxItems: 100,
      maxTlds: 20,
    });
    await jobRepository.claim(id, "owner-x");
    const counts = await jobRepository.cancel(id);
    expect(counts.skippedCount).toBe(2);
    expect(counts.pendingCount).toBe(0);
    const job = await jobRepository.get(id);
    expect(job?.status).toBe("CANCELLED");
  });

  it("enforces the per-job unique fqdn constraint", async () => {
    const { id } = await jobRepository.create({
      rawInput: "dup.com",
      requestedTlds: [".com"],
      items: [{ sld: "dup", tld: ".com" }],
      maxItems: 100,
      maxTlds: 20,
    });
    await expect(
      prisma.researchJobItem.create({
        data: { jobId: id, sld: "dup", tld: ".com", fqdn: "dup.com" },
      }),
    ).rejects.toThrow();
  });

  it("cascades items when a job is deleted", async () => {
    const { id } = await jobRepository.create({
      rawInput: "z.com",
      requestedTlds: [".com"],
      items: [{ sld: "z", tld: ".com" }],
      maxItems: 100,
      maxTlds: 20,
    });
    await prisma.researchJob.delete({ where: { id } });
    const remaining = await prisma.researchJobItem.findMany({ where: { jobId: id } });
    expect(remaining).toHaveLength(0);
  });
});
