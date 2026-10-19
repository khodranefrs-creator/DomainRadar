// Durable batch-job repository. The ONLY place that reads/writes ResearchJob and
// ResearchJobItem. Feature code goes through the engine, which goes through here.
//
// Concurrency: serverless functions can run in parallel, so a job step must not
// double-process items. We use a short lease (see prisma/schema.prisma) claimed
// via an atomic compare-and-swap (`updateMany` with a `where` that only matches
// when no unexpired lease is held). A crashed step's lease simply expires and
// the next step reclaims it — the job never wedges.

import { prisma } from "../db";
import {
  ResearchJobStatus,
  type ResearchJobStatus as JobStatus,
} from "../enums";
import type { PlannedItem, RejectedLine } from "./spec";

export const LEASE_MS = 60_000;

export interface JobCounts {
  totalItems: number;
  pendingCount: number;
  runningCount: number;
  doneCount: number;
  failedCount: number;
  skippedCount: number;
}

function emptycounts(): JobCounts {
  return {
    totalItems: 0,
    pendingCount: 0,
    runningCount: 0,
    doneCount: 0,
    failedCount: 0,
    skippedCount: 0,
  };
}

export const jobRepository = {
  async create(input: {
    rawInput: string;
    sourceLabel?: string | null;
    requestedTlds: string[];
    items: PlannedItem[];
    maxItems: number;
    maxTlds: number;
  }) {
    const items = input.items;
    const counts: JobCounts = {
      ...emptycounts(),
      totalItems: items.length,
      pendingCount: items.length,
    };
    return prisma.researchJob.create({
      data: {
        kind: "BULK_AVAILABILITY",
        status: ResearchJobStatus.PENDING,
        rawInput: input.rawInput.slice(0, 200_000),
        sourceLabel: input.sourceLabel ?? null,
        requestedTlds: JSON.stringify(input.requestedTlds),
        maxItems: input.maxItems,
        maxTlds: input.maxTlds,
        ...counts,
        items: {
          create: items.map((it) => ({
            sld: it.sld,
            tld: it.tld,
            fqdn: `${it.sld}${it.tld}`,
            status: "PENDING",
          })),
        },
      },
      select: { id: true },
    });
  },

  async get(id: string) {
    return prisma.researchJob.findUnique({ where: { id } });
  },

  async list(limit = 20) {
    return prisma.researchJob.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), 100),
      select: {
        id: true,
        status: true,
        sourceLabel: true,
        totalItems: true,
        pendingCount: true,
        runningCount: true,
        doneCount: true,
        failedCount: true,
        skippedCount: true,
        createdAt: true,
        finishedAt: true,
      },
    });
  },

  async items(id: string, opts: { status?: string; limit?: number; offset?: number } = {}) {
    const where: Record<string, unknown> = { jobId: id };
    if (opts.status) where.status = opts.status;
    const [rows, total] = await Promise.all([
      prisma.researchJobItem.findMany({
        where,
        orderBy: [{ status: "asc" }, { fqdn: "asc" }],
        take: Math.min(opts.limit ?? 200, 1000),
        skip: opts.offset ?? 0,
      }),
      prisma.researchJobItem.count({ where }),
    ]);
    return { items: rows, total };
  },

  async allItems(id: string) {
    return prisma.researchJobItem.findMany({
      where: { jobId: id },
      orderBy: { fqdn: "asc" },
    });
  },

  /**
   * Claim the job for a step. Atomic: only succeeds if the job is advanceable
   * and no live lease is held. Returns the claimed job or null.
   */
  async claim(id: string, owner: string) {
    const now = new Date();
    const res = await prisma.researchJob.updateMany({
      where: {
        id,
        status: { in: [ResearchJobStatus.PENDING, ResearchJobStatus.RUNNING, ResearchJobStatus.PAUSED] },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      },
      data: {
        status: ResearchJobStatus.RUNNING,
        leaseOwner: owner,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        finishedAt: null,
      },
    });
    if (res.count === 0) return null;
    return prisma.researchJob.findUnique({ where: { id } });
  },

  async renewLease(id: string, owner: string) {
    await prisma.researchJob.updateMany({
      where: { id, leaseOwner: owner },
      data: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
    });
  },

  async releaseLease(id: string, owner: string) {
    await prisma.researchJob.updateMany({
      where: { id, leaseOwner: owner },
      data: { leaseOwner: null, leaseExpiresAt: null },
    });
  },

  /** Take the next N PENDING items and mark them RUNNING. */
  async takePending(id: string, limit: number) {
    const rows = await prisma.researchJobItem.findMany({
      where: { jobId: id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true },
    });
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    await prisma.researchJobItem.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status: "RUNNING" },
    });
    return ids;
  },

  async finishItem(
    itemId: string,
    data: {
      status: string;
      normalizedStatus?: string | null;
      httpStatus?: number | null;
      providerHost?: string | null;
      requestUrl?: string | null;
      errorKind?: string | null;
      errorDetails?: string | null;
      responseMs?: number | null;
      isFresh?: boolean;
      checkedAt?: Date | null;
      lastError?: string | null;
    },
  ) {
    await prisma.researchJobItem.update({
      where: { id: itemId },
      data: {
        ...data,
        attempts: { increment: 1 },
      },
    });
  },

  /** Recompute denormalized counters from item rows. Source of truth = items. */
  async recount(id: string): Promise<JobCounts> {
    const grouped = await prisma.researchJobItem.groupBy({
      by: ["status"],
      where: { jobId: id },
      _count: { _all: true },
    });
    const counts = emptycounts();
    for (const g of grouped) {
      counts.totalItems += g._count._all;
      switch (g.status) {
        case "PENDING":
          counts.pendingCount = g._count._all;
          break;
        case "RUNNING":
          counts.runningCount = g._count._all;
          break;
        case "DONE":
          counts.doneCount = g._count._all;
          break;
        case "FAILED":
          counts.failedCount = g._count._all;
          break;
        case "SKIPPED":
          counts.skippedCount = g._count._all;
          break;
      }
    }
    await prisma.researchJob.update({ where: { id }, data: counts });
    return counts;
  },

  async setStatus(
    id: string,
    status: JobStatus,
    extra: { lastError?: string | null; finishedAt?: Date | null } = {},
  ) {
    await prisma.researchJob.update({
      where: { id },
      data: {
        status,
        ...(extra.lastError !== undefined ? { lastError: extra.lastError } : {}),
        ...(extra.finishedAt !== undefined ? { finishedAt: extra.finishedAt } : {}),
      },
    });
  },

  /** Return a claimed-but-unstarted RUNNING item to PENDING (step ran out of time). */
  async returnToPending(itemId: string) {
    await prisma.researchJobItem.updateMany({
      where: { id: itemId, status: "RUNNING" },
      data: { status: "PENDING" },
    });
  },

  async setTerminalError(id: string, message: string) {
    await prisma.researchJob.update({
      where: { id },
      data: {
        status: ResearchJobStatus.FAILED,
        lastError: message.slice(0, 2000),
        leaseOwner: null,
        leaseExpiresAt: null,
        finishedAt: new Date(),
      },
    });
  },

  /** Requeue retryable FAILED items back to PENDING for a retry pass. */
  async requeueFailed(id: string) {
    const res = await prisma.researchJobItem.updateMany({
      where: { jobId: id, status: "FAILED" },
      data: { status: "PENDING", lastError: null },
    });
    return res.count;
  },

  async cancel(id: string) {
    await prisma.researchJobItem.updateMany({
      where: { jobId: id, status: "PENDING" },
      data: { status: "SKIPPED", lastError: "Cancelled before it ran" },
    });
    await prisma.researchJobItem.updateMany({
      where: { jobId: id, status: "RUNNING" },
      data: { status: "PENDING" },
    });
    const counts = await this.recount(id);
    await prisma.researchJob.update({
      where: { id },
      data: {
        status: ResearchJobStatus.CANCELLED,
        leaseOwner: null,
        leaseExpiresAt: null,
        finishedAt: new Date(),
      },
    });
    return counts;
  },

  async pause(id: string) {
    await prisma.researchJob.updateMany({
      where: { id },
      data: {
        status: ResearchJobStatus.PAUSED,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
  },

  async pendingCount(id: string) {
    return prisma.researchJobItem.count({
      where: { jobId: id, status: "PENDING" },
    });
  },
};

export type { RejectedLine };
