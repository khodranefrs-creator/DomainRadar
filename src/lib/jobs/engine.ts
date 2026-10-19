// Batch engine: advances one bounded slice of a durable ResearchJob.
//
// A "step" is a single serverless request's worth of work. The client calls
// POST /api/jobs/[id]/step repeatedly; each call claims the job, processes a
// bounded number of items (bounded by item count AND a wall-clock deadline so a
// request never runs away), persists every item result, recomputes counters and
// releases the lease. Progress survives cold starts because it lives in the DB.
//
// There is NO detached background worker here: that is a deliberate, honest
// response to the deployment constraint that a serverless process may be frozen
// the instant the response is returned. The durable job + client-driven stepping
// gives the same user-visible behaviour (resumable, cancellable, observable)
// without pretending the platform offers something it does not.

import { prisma } from "../db";
import {
  AvailabilityStatus,
  ResearchJobStatus,
  SourceStatus,
  TldStatus,
} from "../enums";
import { bootstrapBasesFor, loadBootstrap } from "../rdap/bootstrap";
import { rdapLookupDomain } from "../rdap/client";
import { sourceKeyForHost } from "../rdap/providers";
import { defaultDelay, RateLimiter } from "../rdap/rate-limiter";
import type { BootstrapMap, RdapOutcome } from "../rdap/types";
import { settingsRepository } from "../repository";
import { jobRepository } from "./repository";

const CACHEABLE = new Set<string>([
  AvailabilityStatus.REGISTERED,
  AvailabilityStatus.NOT_FOUND,
  AvailabilityStatus.RESERVED,
  AvailabilityStatus.RESTRICTED,
]);

export interface StepOptions {
  /** Max items to process in this step (default 40). */
  maxItems?: number;
  /** Wall-clock deadline for this step in ms (default 25_000). */
  deadlineMs?: number;
  /** Called after each item for streaming/progress (tests can observe). */
  onProgress?: () => void;
  /** Override the engine's network/persistence seams (used by tests). */
  deps?: Partial<EngineDeps>;
}

/** Injectable seams so the step runner can be tested without live network. */
export interface EngineDeps {
  loadBootstrapMap: () => Promise<BootstrapMap | null>;
  lookup: (
    fqdn: string,
    base: string,
    opts: { timeoutMs: number; maxRetries: number; rateLimiter: RateLimiter },
  ) => Promise<RdapOutcome>;
  loadTld: (tld: string) => Promise<TldRow | null>;
  getSettings: () => Promise<{ requestDelayMs: number; requestBudgetPerRun: number }>;
  countNetworkAttempts: (jobId: string) => Promise<number>;
  saveAudit: (record: {
    row: TldRow;
    item: ItemRow;
    outcome: RdapOutcome;
    host: string;
    sourceId: string;
    checkedAt: Date;
    isFresh: boolean;
  }) => Promise<void>;
  findFreshCheck: (fqdn: string, since: Date) => Promise<{ normalizedStatus: string; httpStatus: number | null; checkedAt: Date } | null>;
  ensureSource: (host: string) => Promise<SourceInfo>;
}

export interface StepResult {
  jobId: string;
  status: string;
  processed: number;
  counts: {
    totalItems: number;
    pendingCount: number;
    runningCount: number;
    doneCount: number;
    failedCount: number;
    skippedCount: number;
  };
  /** True when there is still PENDING work after this step. */
  hasMore: boolean;
  /** Set when the step could not claim the job (another step holds the lease). */
  skippedClaim?: boolean;
}

interface TldRow {
  id: string;
  tld: string;
  status: string;
  rdapBaseUrl: string | null;
  registryName: string | null;
}

interface ItemRow {
  id: string;
  sld: string;
  tld: string;
  fqdn: string;
}

interface SourceInfo {
  id: string;
  name: string;
  key: string;
  cacheTtlSeconds: number;
  timeoutMs: number;
  maxRetries: number;
  rateLimitPerMinute: number | null;
}

const OWNER = () => `step-${Math.random().toString(36).slice(2)}-${Date.now()}`;

/** Default seams backed by Prisma + the live RDAP adapter. */
export function createDefaultEngineDeps(): EngineDeps {
  return {
    loadBootstrapMap: async () => {
      try {
        return await loadBootstrap();
      } catch {
        return null;
      }
    },
    lookup: (fqdn, base, opts) =>
      rdapLookupDomain(fqdn, base, {
        rateLimiter: opts.rateLimiter,
        timeoutMs: opts.timeoutMs,
        maxRetries: opts.maxRetries,
      }),
    loadTld: (tld) => prisma.tldRegistry.findUnique({ where: { tld } }),
    getSettings: async () => {
      const s = await settingsRepository.get();
      return {
        requestDelayMs: s.requestDelayMs,
        requestBudgetPerRun: s.requestBudgetPerRun,
      };
    },
    countNetworkAttempts: (jobId) =>
      prisma.researchJobItem.count({ where: { jobId, attempts: { gt: 0 } } }),
    saveAudit: async ({ row, item, outcome, host, sourceId, checkedAt, isFresh }) => {
      // Persist an audit record so batch results join the same evidence trail as
      // interactive searches (sessionId is null: this is a batch check).
      await prisma.domainVariantCheck.create({
        data: {
          sessionId: null,
          sourceId,
          tldId: row.id,
          fqdn: item.fqdn,
          providerHost: outcome.providerHost ?? host,
          requestUrl: outcome.requestUrl,
          httpStatus: outcome.httpStatus,
          rawStatus: outcome.rawStatus,
          normalizedStatus: outcome.status,
          errorKind: outcome.errorKind,
          errorDetails: outcome.errorDetails,
          responseMs: outcome.responseMs,
          checkedAt,
          isFresh,
        },
      });
      await prisma.source.update({
        where: { id: sourceId },
        data: {
          lastCheckedAt: checkedAt,
          ...(outcome.errorKind ? {} : { lastSuccessAt: checkedAt }),
        },
      });
    },
    findFreshCheck: async (fqdn, since) => {
      const row = await prisma.domainVariantCheck.findFirst({
        where: {
          fqdn,
          normalizedStatus: { in: Array.from(CACHEABLE) },
          checkedAt: { gte: since },
        },
        orderBy: { checkedAt: "desc" },
      });
      return row
        ? {
            normalizedStatus: row.normalizedStatus,
            httpStatus: row.httpStatus,
            checkedAt: row.checkedAt,
          }
        : null;
    },
    ensureSource: async (host) => {
      const key = sourceKeyForHost(host);
      const existing = await prisma.source.findUnique({ where: { key } });
      if (existing) return existing;
      return prisma.source.create({
        data: {
          key,
          name: `RDAP ${host}`,
          kind: "RDAP",
          status: SourceStatus.AVAILABLE,
          permittedUseNotes:
            "Discovered and used via the IANA RDAP bootstrap for availability lookups.",
          attributionRequired: false,
          requiresAuth: false,
          rateLimitPerMinute: null,
          cacheTtlSeconds: 3600,
          timeoutMs: 10_000,
          maxRetries: 2,
          lastCheckedAt: new Date(),
        },
      });
    },
  };
}

function enumerationResult(
  row: TldRow,
  status: string,
  detail: string,
): {
  status: "DONE" | "SKIPPED";
  normalizedStatus: string;
  errorKind: string | null;
  errorDetails: string;
} {
  // Unsupported / disabled / unknown are deliberately not attempted: SKIPPED.
  if (
    status === AvailabilityStatus.UNSUPPORTED ||
    status === "DISABLED" ||
    status === "UNKNOWN_TLD" ||
    status === "NEEDS_VERIFICATION"
  ) {
    return {
      status: "SKIPPED",
      normalizedStatus: status,
      errorKind: null,
      errorDetails: detail,
    };
  }
  return {
    status: "DONE",
    normalizedStatus: status,
    errorKind: null,
    errorDetails: detail,
  };
}

function getLimiter(
  cache: Map<string, RateLimiter>,
  host: string,
  rateLimitPerMinute: number | null,
  defaultMinIntervalMs: number,
): RateLimiter {
  const existing = cache.get(host);
  if (existing) return existing;
  const interval =
    rateLimitPerMinute && rateLimitPerMinute > 0
      ? Math.ceil(60_000 / rateLimitPerMinute)
      : defaultMinIntervalMs;
  const limiter = new RateLimiter(interval, { delay: defaultDelay });
  cache.set(host, limiter);
  return limiter;
}

async function resolveNetworkItem(
  item: ItemRow,
  row: TldRow,
  base: string,
  deps: EngineDeps & {
    limiters: Map<string, RateLimiter>;
    defaultMinIntervalMs: number;
  },
): Promise<
  | {
      status: "DONE" | "FAILED";
      normalizedStatus: string;
      httpStatus: number | null;
      providerHost: string | null;
      requestUrl: string | null;
      errorKind: string | null;
      errorDetails: string | null;
      responseMs: number | null;
      isFresh: boolean;
      checkedAt: Date;
      lastError: string | null;
      sourceId: string;
    }
  | null
> {
  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    return null; // unusable base; caller records an honest SKIPPED state
  }

  const source = await deps.ensureSource(host);
  const ttlMs = Math.max(0, source.cacheTtlSeconds) * 1000;

  if (ttlMs > 0) {
    const fresh = await deps.findFreshCheck(item.fqdn, new Date(Date.now() - ttlMs));
    if (fresh && CACHEABLE.has(fresh.normalizedStatus)) {
      return {
        status: "DONE",
        normalizedStatus: fresh.normalizedStatus,
        httpStatus: fresh.httpStatus,
        providerHost: host,
        requestUrl: null,
        errorKind: null,
        errorDetails: "Served from cache within its freshness window.",
        responseMs: null,
        isFresh: true,
        checkedAt: fresh.checkedAt,
        lastError: null,
        sourceId: source.id,
      };
    }
  }

  const limiter = getLimiter(
    deps.limiters,
    host,
    source.rateLimitPerMinute,
    deps.defaultMinIntervalMs,
  );
  const outcome: RdapOutcome = await deps.lookup(item.fqdn, base, {
    timeoutMs: source.timeoutMs,
    maxRetries: source.maxRetries,
    rateLimiter: limiter,
  });

  const checkedAt = new Date();
  const isFresh = CACHEABLE.has(outcome.status);
  const definite = isFresh;

  try {
    await deps.saveAudit({ row, item, outcome, host, sourceId: source.id, checkedAt, isFresh });
  } catch {
    // A persistence failure must not hide the observed result.
  }

  return {
    status: definite ? "DONE" : "FAILED",
    normalizedStatus: outcome.status,
    httpStatus: outcome.httpStatus,
    providerHost: outcome.providerHost ?? host,
    requestUrl: outcome.requestUrl,
    errorKind: outcome.errorKind,
    errorDetails: outcome.errorDetails,
    responseMs: outcome.responseMs,
    isFresh,
    checkedAt,
    lastError:
      outcome.errorKind || !definite
        ? (outcome.errorDetails ?? outcome.status)
        : null,
    sourceId: source.id,
  };
}

/** Advance a job by one bounded step. Safe to call concurrently. */
export async function runJobStep(
  jobId: string,
  options: StepOptions = {},
): Promise<StepResult> {
  const maxItems = Math.max(1, Math.min(options.maxItems ?? 40, 200));
  const deadlineMs = Math.max(1000, Math.min(options.deadlineMs ?? 25_000, 55_000));
  const deps: EngineDeps = { ...createDefaultEngineDeps(), ...options.deps };

  const owner = OWNER();
  const claimed = await jobRepository.claim(jobId, owner);
  if (!claimed) {
    const current = await jobRepository.get(jobId);
    if (!current) throw new Error("Job not found");
    return {
      jobId,
      status: current.status,
      processed: 0,
      counts: {
        totalItems: current.totalItems,
        pendingCount: current.pendingCount,
        runningCount: current.runningCount,
        doneCount: current.doneCount,
        failedCount: current.failedCount,
        skippedCount: current.skippedCount,
      },
      hasMore: current.pendingCount > 0,
      skippedClaim: true,
    };
  }

  const startedAt = Date.now();
  const settings = await deps.getSettings();
  const defaultMinIntervalMs = Math.max(250, settings.requestDelayMs);
  // Respect the configured per-run request budget for the whole job's outbound
  // network lookups: once the job has performed this many lookups, the rest are
  // reported as RATE_LIMITED (not attempted) rather than silently dropped.
  const budget = settings.requestBudgetPerRun;

  let networkAttempts = await deps.countNetworkAttempts(jobId);

  const limiters = new Map<string, RateLimiter>();
  let bootstrap: BootstrapMap | null = null;

  const itemIds = await jobRepository.takePending(jobId, maxItems);
  let processed = 0;

  try {
    for (const itemId of itemIds) {
      if (Date.now() - startedAt >= deadlineMs) {
        // Out of time: put this item back so a later step picks it up.
        await jobRepository.returnToPending(itemId);
        continue;
      }

      const item = await prisma.researchJobItem.findUnique({
        where: { id: itemId },
        select: { id: true, sld: true, tld: true, fqdn: true },
      });
      if (!item) continue;

      const row = await deps.loadTld(item.tld);

      if (!row) {
        const r = enumerationResult(
          { id: "", tld: item.tld, status: "UNKNOWN_TLD", rdapBaseUrl: null, registryName: null },
          "UNKNOWN_TLD",
          "Extension is not registered in the TLD registry; no lookup attempted.",
        );
        await jobRepository.finishItem(itemId, {
          status: "SKIPPED",
          normalizedStatus: r.normalizedStatus,
          errorDetails: r.errorDetails,
          checkedAt: new Date(),
        });
        processed++;
        options.onProgress?.();
        continue;
      }

      if (
        row.status === TldStatus.UNSUPPORTED ||
        row.status === TldStatus.DISABLED ||
        row.status === TldStatus.NEEDS_VERIFICATION
      ) {
        const statusFor =
          row.status === TldStatus.UNSUPPORTED
            ? AvailabilityStatus.UNSUPPORTED
            : row.status;
        const detail =
          row.status === TldStatus.UNSUPPORTED
            ? "No verified RDAP endpoint for this extension."
            : row.status === TldStatus.DISABLED
              ? "Disabled in the TLD registry; no lookup attempted."
              : "RDAP capability not yet verified for this extension.";
        await jobRepository.finishItem(itemId, {
          status: "SKIPPED",
          normalizedStatus: statusFor,
          errorDetails: detail,
          checkedAt: new Date(),
        });
        processed++;
        options.onProgress?.();
        continue;
      }

      if (budget > 0 && networkAttempts >= budget) {
        await jobRepository.finishItem(itemId, {
          status: "FAILED",
          normalizedStatus: AvailabilityStatus.RATE_LIMITED,
          errorKind: "RATE_LIMITED",
          errorDetails: `Request budget for this instance (${budget}) reached; lookup not attempted.`,
          lastError: "Request budget reached",
          checkedAt: new Date(),
        });
        processed++;
        options.onProgress?.();
        continue;
      }

      if (!bootstrap) {
        try {
          bootstrap = await deps.loadBootstrapMap();
        } catch {
          bootstrap = null;
        }
      }
      const base =
        bootstrapBasesFor(bootstrap, item.tld)[0] ?? row.rdapBaseUrl ?? null;
      if (!base) {
        const r = enumerationResult(
          row,
          AvailabilityStatus.UNSUPPORTED,
          "Registry marked available but no RDAP base could be resolved.",
        );
        await jobRepository.finishItem(itemId, {
          status: "SKIPPED",
          normalizedStatus: r.normalizedStatus,
          errorDetails: r.errorDetails,
          checkedAt: new Date(),
        });
        processed++;
        options.onProgress?.();
        continue;
      }

      networkAttempts++;
      try {
        const result = await resolveNetworkItem(
          { id: item.id, sld: item.sld, tld: item.tld, fqdn: item.fqdn },
          row,
          base,
          { ...deps, limiters, defaultMinIntervalMs },
        );
        if (!result) {
          await jobRepository.finishItem(itemId, {
            status: "SKIPPED",
            normalizedStatus: AvailabilityStatus.UNSUPPORTED,
            errorDetails:
              "Registry marked available but the RDAP base URL is unusable.",
            checkedAt: new Date(),
          });
          processed++;
          options.onProgress?.();
          continue;
        }
        await jobRepository.finishItem(itemId, {
          status: result.status,
          normalizedStatus: result.normalizedStatus,
          httpStatus: result.httpStatus,
          providerHost: result.providerHost,
          requestUrl: result.requestUrl,
          errorKind: result.errorKind,
          errorDetails: result.errorDetails,
          responseMs: result.responseMs,
          isFresh: result.isFresh,
          checkedAt: result.checkedAt,
          lastError: result.lastError,
        });
      } catch (err) {
        await jobRepository.finishItem(itemId, {
          status: "FAILED",
          normalizedStatus: AvailabilityStatus.ERROR,
          errorKind: "NETWORK",
          errorDetails: err instanceof Error ? err.message : "Lookup failed",
          lastError: err instanceof Error ? err.message : "Lookup failed",
          checkedAt: new Date(),
        });
      }
      processed++;
      options.onProgress?.();
    }
  } finally {
    const counts = await jobRepository.recount(jobId);
    const pending = counts.pendingCount;
    if (pending === 0) {
      await jobRepository.setStatus(jobId, ResearchJobStatus.COMPLETED, {
        finishedAt: new Date(),
      });
      await jobRepository.releaseLease(jobId, owner);
    } else {
      await jobRepository.releaseLease(jobId, owner);
    }
  }

  const final = await jobRepository.get(jobId);
  const finalPending = final?.pendingCount ?? 0;
  return {
    jobId,
    status: final?.status ?? ResearchJobStatus.RUNNING,
    processed,
    counts: {
      totalItems: final?.totalItems ?? 0,
      pendingCount: final?.pendingCount ?? 0,
      runningCount: final?.runningCount ?? 0,
      doneCount: final?.doneCount ?? 0,
      failedCount: final?.failedCount ?? 0,
      skippedCount: final?.skippedCount ?? 0,
    },
    hasMore: finalPending > 0,
  };
}
