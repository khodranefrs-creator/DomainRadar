// Multi-TLD search orchestration. Given a name and a set of TLDs, resolve each
// variant: UNSUPPORTED/unknown extensions are reported without a network call,
// supported extensions are checked via RDAP (with caching), and every check is
// persisted with full audit metadata. Results are aggregated into a session
// summary using explicit statuses.

import { AvailabilityStatus, SessionStatus, SourceStatus, TldStatus } from "../enums";
import { prisma } from "../db";
import { bootstrapBasesFor, loadBootstrap } from "./bootstrap";
import { rdapLookupDomain } from "./client";
import { sourceKeyForHost } from "./providers";
import { defaultDelay, RateLimiter } from "./rate-limiter";
import type { BootstrapMap, RdapOutcome, Sleeper } from "./types";

export interface TldInfo {
  id: string;
  tld: string;
  status: string;
  rdapBaseUrl: string | null;
  registryName: string | null;
}

export interface SourceInfo {
  id: string;
  key: string;
  name: string;
  cacheTtlSeconds: number;
  timeoutMs: number;
  maxRetries: number;
  rateLimitPerMinute: number | null;
}

export interface FreshCheck {
  normalizedStatus: string;
  httpStatus: number | null;
  checkedAt: Date;
}

export interface VariantCheckRecord {
  sessionId: string | null;
  sourceId: string;
  tldId: string;
  fqdn: string;
  providerHost: string | null;
  requestUrl: string | null;
  httpStatus: number | null;
  rawStatus: string | null;
  normalizedStatus: string;
  errorKind: string | null;
  errorDetails: string | null;
  responseMs: number | null;
  checkedAt: Date;
  isFresh: boolean;
}

export interface SessionCounts {
  requestedCount: number;
  checkedCount: number;
  registeredCount: number;
  notFoundCount: number;
  unsupportedCount: number;
  unresolvedCount: number;
  errorCount: number;
}

export interface VariantResult {
  tld: string;
  fqdn: string;
  status: string;
  source: string | null;
  sourceKey: string | null;
  providerHost: string | null;
  requestUrl: string | null;
  httpStatus: number | null;
  errorKind: string | null;
  lastCheckedAt: string | null;
  cached: boolean;
  detail: string;
}

export interface SearchSummary extends SessionCounts {
  sessionId: string;
  sld: string;
  status: string;
  variants: VariantResult[];
  note: string;
}

export interface SearchRequest {
  rawQuery: string;
  sld: string;
  requestedTlds: string[];
}

export interface SearchDeps {
  now: () => number;
  delay: Sleeper;
  defaultMinIntervalMs: number;
  maxConcurrency: number;
  /** Hard cap on outbound registry lookups in a single run. 0 = unlimited. */
  requestBudgetPerRun: number;
  loadTlds: (tlds: string[]) => Promise<TldInfo[]>;
  loadBootstrapMap: () => Promise<BootstrapMap | null>;
  ensureSource: (host: string) => Promise<SourceInfo>;
  findFreshCheck: (
    fqdn: string,
    tld: string,
    since: Date,
  ) => Promise<FreshCheck | null>;
  saveVariantCheck: (record: VariantCheckRecord) => Promise<void>;
  createSession: (data: {
    rawQuery: string;
    sld: string;
    requestedTlds: string[];
  }) => Promise<{ id: string }>;
  finalizeSession: (
    id: string,
    data: SessionCounts & { status: string },
  ) => Promise<void>;
  lookup: (
    fqdn: string,
    baseUrl: string,
    options: {
      rateLimiter: RateLimiter;
      timeoutMs: number;
      maxRetries: number;
    },
  ) => Promise<RdapOutcome>;
  syncCandidateAvailability?: (
    fqdn: string,
    sourceId: string,
    outcome: RdapOutcome,
  ) => Promise<void>;
}

const NOTE =
  "RDAP reports registry state only. NOT_FOUND means no registry record was " +
  "returned — it is NOT proof a domain is available for registration " +
  "(premium, reserved or trademark-restricted names may still be unavailable).";

function unique(list: string[]): string[] {
  return Array.from(new Set(list));
}

function enumerationVariant(
  tld: string,
  fqdn: string,
  status: string,
  source: string | null,
  detail: string,
): VariantResult {
  return {
    tld,
    fqdn,
    status,
    source,
    sourceKey: null,
    providerHost: null,
    requestUrl: null,
    httpStatus: null,
    errorKind: null,
    lastCheckedAt: null,
    cached: false,
    detail,
  };
}

function outcomeDetail(outcome: RdapOutcome): string {
  if (outcome.errorKind && outcome.errorDetails) return outcome.errorDetails;
  switch (outcome.status) {
    case AvailabilityStatus.REGISTERED:
      return "RDAP domain record present (registered).";
    case AvailabilityStatus.NOT_FOUND:
      return "No RDAP record. Not a guarantee the name is registrable.";
    case AvailabilityStatus.RATE_LIMITED:
      return "Provider rate limited; result unresolved.";
    case AvailabilityStatus.UNSUPPORTED:
      return "No verified RDAP path for this extension.";
    default:
      return outcome.errorDetails ?? "Result inconclusive.";
  }
}

const CACHEABLE = new Set<string>([
  AvailabilityStatus.REGISTERED,
  AvailabilityStatus.NOT_FOUND,
  AvailabilityStatus.RESERVED,
  AvailabilityStatus.RESTRICTED,
]);

function getLimiter(
  cache: Map<string, RateLimiter>,
  host: string,
  rateLimitPerMinute: number | null,
  deps: SearchDeps,
): RateLimiter {
  const existing = cache.get(host);
  if (existing) return existing;
  const interval =
    rateLimitPerMinute && rateLimitPerMinute > 0
      ? Math.ceil(60_000 / rateLimitPerMinute)
      : deps.defaultMinIntervalMs;
  const limiter = new RateLimiter(interval, { now: deps.now, delay: deps.delay });
  cache.set(host, limiter);
  return limiter;
}

async function checkAvailableVariant(
  job: { tld: string; fqdn: string; row: TldInfo; base: string },
  sessionId: string,
  deps: SearchDeps,
  limiters: Map<string, RateLimiter>,
): Promise<VariantResult> {
  const { tld, fqdn, row, base } = job;
  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    return enumerationVariant(
      tld,
      fqdn,
      AvailabilityStatus.UNSUPPORTED,
      row.registryName,
      "Registry marked available but the RDAP base URL is unusable.",
    );
  }

  const source = await deps.ensureSource(host);
  const ttlMs = Math.max(0, source.cacheTtlSeconds) * 1000;
  const nowMs = deps.now();

  if (ttlMs > 0) {
    const fresh = await deps.findFreshCheck(
      fqdn,
      tld,
      new Date(nowMs - ttlMs),
    );
    if (fresh && CACHEABLE.has(fresh.normalizedStatus)) {
      return {
        tld,
        fqdn,
        status: fresh.normalizedStatus,
        source: source.name,
        sourceKey: source.key,
        providerHost: host,
        requestUrl: null,
        httpStatus: fresh.httpStatus,
        errorKind: null,
        lastCheckedAt: fresh.checkedAt.toISOString(),
        cached: true,
        detail: "Served from cache within its freshness window.",
      };
    }
  }

  const limiter = getLimiter(limiters, host, source.rateLimitPerMinute, deps);
  const outcome = await deps.lookup(fqdn, base, {
    rateLimiter: limiter,
    timeoutMs: source.timeoutMs,
    maxRetries: source.maxRetries,
  });

  const checkedAt = new Date(deps.now());
  const isFresh = CACHEABLE.has(outcome.status);

  try {
    await deps.saveVariantCheck({
      sessionId,
      sourceId: source.id,
      tldId: row.id,
      fqdn,
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
    });
    if (deps.syncCandidateAvailability) {
      await deps.syncCandidateAvailability(fqdn, source.id, outcome);
    }
  } catch {
    // Persistence failure must not hide the observed result.
  }

  return {
    tld,
    fqdn,
    status: outcome.status,
    source: source.name,
    sourceKey: source.key,
    providerHost: outcome.providerHost ?? host,
    requestUrl: outcome.requestUrl,
    httpStatus: outcome.httpStatus,
    errorKind: outcome.errorKind,
    lastCheckedAt: checkedAt.toISOString(),
    cached: false,
    detail: outcomeDetail(outcome),
  };
}

function tally(variants: VariantResult[]): SessionCounts {
  const counts: SessionCounts = {
    requestedCount: variants.length,
    checkedCount: 0,
    registeredCount: 0,
    notFoundCount: 0,
    unsupportedCount: 0,
    unresolvedCount: 0,
    errorCount: 0,
  };
  for (const v of variants) {
    switch (v.status) {
      case AvailabilityStatus.REGISTERED:
        counts.registeredCount++;
        counts.checkedCount++;
        break;
      case AvailabilityStatus.NOT_FOUND:
        counts.notFoundCount++;
        counts.checkedCount++;
        break;
      case AvailabilityStatus.RESERVED:
      case AvailabilityStatus.RESTRICTED:
        counts.checkedCount++;
        break;
      case AvailabilityStatus.UNSUPPORTED:
        counts.unsupportedCount++;
        break;
      case AvailabilityStatus.ERROR:
      case AvailabilityStatus.RATE_LIMITED:
        counts.errorCount++;
        break;
      default:
        counts.unresolvedCount++;
        break;
    }
  }
  return counts;
}

function sessionStatusFor(counts: SessionCounts): string {
  if (counts.errorCount > 0 && counts.checkedCount === 0) return SessionStatus.FAILED;
  if (counts.errorCount > 0) return SessionStatus.PARTIAL;
  if (counts.checkedCount === 0) return SessionStatus.PARTIAL;
  return SessionStatus.COMPLETED;
}

async function pool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  let cursor = 0;
  const runners = Array.from({ length: limit }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

export async function runSearch(
  request: SearchRequest,
  deps: SearchDeps = createDefaultSearchDeps(),
): Promise<SearchSummary> {
  const requestedTlds = unique(request.requestedTlds);
  const session = await deps.createSession({
    rawQuery: request.rawQuery,
    sld: request.sld,
    requestedTlds,
  });

  const tldRows = await deps.loadTlds(requestedTlds);
  const byTld = new Map(tldRows.map((r) => [r.tld, r]));

  const needsBootstrap = requestedTlds.some(
    (t) => byTld.get(t)?.status === TldStatus.AVAILABLE,
  );
  let bootstrap: BootstrapMap | null = null;
  if (needsBootstrap) {
    try {
      bootstrap = await deps.loadBootstrapMap();
    } catch {
      bootstrap = null;
    }
  }

  const results: VariantResult[] = new Array(requestedTlds.length);
  const jobs: Array<{ index: number; tld: string; fqdn: string; row: TldInfo; base: string }> = [];

  for (let i = 0; i < requestedTlds.length; i++) {
    const tld = requestedTlds[i];
    const fqdn = `${request.sld}${tld}`;
    const row = byTld.get(tld);

    if (!row) {
      results[i] = enumerationVariant(
        tld,
        fqdn,
        "UNKNOWN_TLD",
        null,
        "Extension is not registered in the TLD registry; no lookup attempted.",
      );
      continue;
    }
    if (row.status === TldStatus.UNSUPPORTED) {
      results[i] = enumerationVariant(
        tld,
        fqdn,
        AvailabilityStatus.UNSUPPORTED,
        row.registryName,
        "No verified RDAP endpoint for this extension.",
      );
      continue;
    }
    if (row.status === TldStatus.DISABLED) {
      results[i] = enumerationVariant(
        tld,
        fqdn,
        "DISABLED",
        row.registryName,
        "Disabled in the TLD registry; no lookup attempted.",
      );
      continue;
    }
    if (row.status === TldStatus.NEEDS_VERIFICATION) {
      results[i] = enumerationVariant(
        tld,
        fqdn,
        "NEEDS_VERIFICATION",
        row.registryName,
        "RDAP capability not yet verified for this extension.",
      );
      continue;
    }

    const base = bootstrapBasesFor(bootstrap, tld)[0] ?? row.rdapBaseUrl ?? null;
    if (!base) {
      results[i] = enumerationVariant(
        tld,
        fqdn,
        AvailabilityStatus.UNSUPPORTED,
        row.registryName,
        "Registry marked available but no RDAP base could be resolved.",
      );
      continue;
    }

    jobs.push({ index: i, tld, fqdn, row, base });
  }

  const limiters = new Map<string, RateLimiter>();
  const budget = deps.requestBudgetPerRun;
  let attempts = 0;
  await pool(jobs, deps.maxConcurrency, async (job) => {
    if (budget > 0 && attempts >= budget) {
      results[job.index] = enumerationVariant(
        job.tld,
        job.fqdn,
        AvailabilityStatus.RATE_LIMITED,
        job.row.registryName,
        `Request budget for this run (${budget}) was reached before this lookup; it was not attempted.`,
      );
      return;
    }
    attempts++;
    results[job.index] = await checkAvailableVariant(job, session.id, deps, limiters);
  });

  const variants = results.filter(Boolean);
  const counts = tally(variants);
  const status = sessionStatusFor(counts);

  await deps.finalizeSession(session.id, { ...counts, status });

  return {
    sessionId: session.id,
    sld: request.sld,
    status,
    ...counts,
    variants,
    note: NOTE,
  };
}

function toSourceInfo(row: {
  id: string;
  key: string;
  name: string;
  cacheTtlSeconds: number;
  timeoutMs: number;
  maxRetries: number;
  rateLimitPerMinute: number | null;
}): SourceInfo {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    cacheTtlSeconds: row.cacheTtlSeconds,
    timeoutMs: row.timeoutMs,
    maxRetries: row.maxRetries,
    rateLimitPerMinute: row.rateLimitPerMinute,
  };
}

export interface DefaultDepsOptions {
  defaultMinIntervalMs?: number;
  maxConcurrency?: number;
  requestBudgetPerRun?: number;
  now?: () => number;
  delay?: Sleeper;
}

export function createDefaultSearchDeps(
  options: DefaultDepsOptions = {},
): SearchDeps {
  return {
    now: options.now ?? (() => Date.now()),
    delay: options.delay ?? defaultDelay,
    defaultMinIntervalMs: options.defaultMinIntervalMs ?? 1000,
    maxConcurrency: options.maxConcurrency ?? 2,
    requestBudgetPerRun: options.requestBudgetPerRun ?? 0,

    loadTlds: async (tlds) =>
      prisma.tldRegistry.findMany({ where: { tld: { in: tlds } } }),

    loadBootstrapMap: async () => {
      try {
        return await loadBootstrap();
      } catch {
        return null;
      }
    },

    ensureSource: async (host) => {
      const key = sourceKeyForHost(host);
      const existing = await prisma.source.findUnique({ where: { key } });
      if (existing) return toSourceInfo(existing);
      const created = await prisma.source.create({
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
      return toSourceInfo(created);
    },

    findFreshCheck: async (fqdn, _tld, since) => {
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

    saveVariantCheck: async (record) => {
      await prisma.domainVariantCheck.create({
        data: {
          sessionId: record.sessionId,
          sourceId: record.sourceId,
          tldId: record.tldId,
          fqdn: record.fqdn,
          providerHost: record.providerHost,
          requestUrl: record.requestUrl,
          httpStatus: record.httpStatus,
          rawStatus: record.rawStatus,
          normalizedStatus: record.normalizedStatus,
          errorKind: record.errorKind,
          errorDetails: record.errorDetails,
          responseMs: record.responseMs,
          checkedAt: record.checkedAt,
          isFresh: record.isFresh,
        },
      });
      await prisma.source.update({
        where: { id: record.sourceId },
        data: {
          lastCheckedAt: record.checkedAt,
          ...(record.errorKind ? {} : { lastSuccessAt: record.checkedAt }),
        },
      });
    },

    createSession: async (data) =>
      prisma.domainSearchSession.create({
        data: {
          rawQuery: data.rawQuery.slice(0, 255),
          normalizedSld: data.sld,
          requestedTlds: JSON.stringify(data.requestedTlds),
          requestedCount: data.requestedTlds.length,
          status: SessionStatus.RUNNING,
        },
        select: { id: true },
      }),

    finalizeSession: async (id, data) => {
      await prisma.domainSearchSession.update({
        where: { id },
        data: {
          status: data.status,
          checkedCount: data.checkedCount,
          registeredCount: data.registeredCount,
          notFoundCount: data.notFoundCount,
          unsupportedCount: data.unsupportedCount,
          unresolvedCount: data.unresolvedCount,
          errorCount: data.errorCount,
          completedAt: new Date(),
        },
      });
    },

    lookup: (fqdn, base, opts) =>
      rdapLookupDomain(fqdn, base, {
        rateLimiter: opts.rateLimiter,
        timeoutMs: opts.timeoutMs,
        maxRetries: opts.maxRetries,
      }),

    syncCandidateAvailability: async (fqdn, sourceId, outcome) => {
      const candidate = await prisma.domainCandidate.findUnique({
        where: { fqdn },
      });
      if (!candidate) return;
      const checkedAt = new Date();
      const isFresh = CACHEABLE.has(outcome.status);
      const expiresAt = new Date(Date.now() + 3600_000);
      const data = {
        tld: candidate.tld,
        fqdn,
        httpStatus: outcome.httpStatus,
        rawStatus: outcome.rawStatus,
        normalizedStatus: outcome.status,
        errorKind: outcome.errorKind,
        errorDetails: outcome.errorDetails,
        responseMs: outcome.responseMs,
        checkedAt,
        expiresAt,
        isFresh,
      };
      await prisma.availabilityCheck.upsert({
        where: {
          candidateId_sourceId: { candidateId: candidate.id, sourceId },
        },
        create: { candidateId: candidate.id, sourceId, ...data },
        update: data,
      });
    },
  };
}
