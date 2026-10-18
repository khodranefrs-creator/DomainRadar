// RDAP service discovery via the IANA bootstrap registry.
//
// The bootstrap file (https://data.iana.org/rdap/dns.json) is the authoritative
// mapping from TLD to the registry's published RDAP base URL(s). We never guess
// an endpoint: if a TLD is not present here (and not otherwise verified in the
// TldRegistry), it is reported UNSUPPORTED rather than silently skipped.

import { assertAllowedUrl } from "../ssrf";
import { defaultDelay, type Clock } from "./rate-limiter";
import type { BootstrapMap, Sleeper } from "./types";

export const IANA_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
export const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000; // published file; matches source registry
export const BOOTSTRAP_TIMEOUT_MS = 15_000;

const TIMEOUT = Symbol("bootstrap-timeout");

export class BootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapError";
  }
}

let cache: BootstrapMap | null = null;
let inflight: Promise<BootstrapMap> | null = null;

/** Parse the raw IANA dns.json payload into a TLD -> base URLs map. */
export function parseBootstrapServices(raw: unknown, now: number): BootstrapMap {
  const services = (raw as { services?: unknown } | null)?.services;
  if (!Array.isArray(services)) {
    throw new BootstrapError(
      "Malformed IANA RDAP bootstrap: missing services array",
    );
  }
  const map = new Map<string, string[]>();
  for (const entry of services) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [tlds, urls] = entry as [unknown, unknown];
    if (!Array.isArray(tlds) || !Array.isArray(urls)) continue;
    const baseUrls = urls.filter(
      (u): u is string => typeof u === "string" && u.trim().length > 0,
    );
    if (baseUrls.length === 0) continue;
    for (const t of tlds) {
      if (typeof t !== "string") continue;
      const key = t.replace(/^\./, "").toLowerCase();
      if (!key) continue;
      map.set(key, baseUrls);
    }
  }
  if (map.size === 0) {
    throw new BootstrapError("IANA RDAP bootstrap contained no usable services");
  }
  return { fetchedAt: now, source: IANA_BOOTSTRAP_URL, services: map };
}

/** Ensure a base URL ends with a slash so relative "domain/<fqdn>" resolves. */
export function normalizeBaseUrl(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}

/** https-only base URLs discovered for a TLD (empty when unsupported). */
export function bootstrapBasesFor(
  map: BootstrapMap | null,
  tld: string,
): string[] {
  if (!map) return [];
  const key = tld.replace(/^\./, "").toLowerCase();
  const bases = map.services.get(key) ?? [];
  const out: string[] = [];
  for (const base of bases) {
    try {
      if (new URL(base).protocol === "https:") out.push(normalizeBaseUrl(base));
    } catch {
      // ignore unusable entries
    }
  }
  return out;
}

export function getBootstrapCacheInfo(): {
  cached: boolean;
  fetchedAt: number | null;
  tldCount: number;
} {
  return {
    cached: cache !== null,
    fetchedAt: cache?.fetchedAt ?? null,
    tldCount: cache?.services.size ?? 0,
  };
}

export function clearBootstrapCache(): void {
  cache = null;
  inflight = null;
}

export interface LoadBootstrapOptions {
  fetchImpl?: typeof fetch;
  now?: Clock;
  delay?: Sleeper;
  timeoutMs?: number;
  ttlMs?: number;
  force?: boolean;
}

/** Load (and memoize) the IANA bootstrap. Concurrent callers share one fetch. */
export async function loadBootstrap(
  opts: LoadBootstrapOptions = {},
): Promise<BootstrapMap> {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? BOOTSTRAP_TTL_MS;
  if (!opts.force && cache && now() - cache.fetchedAt < ttl) return cache;
  if (inflight) return inflight;
  inflight = fetchBootstrap(opts)
    .then((map) => {
      cache = map;
      return map;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function fetchBootstrap(opts: LoadBootstrapOptions): Promise<BootstrapMap> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const delay = opts.delay ?? defaultDelay;
  const timeoutMs = opts.timeoutMs ?? BOOTSTRAP_TIMEOUT_MS;

  const url = assertAllowedUrl(IANA_BOOTSTRAP_URL);
  const controller = new AbortController();
  const timer = delay(timeoutMs).then(() => {
    controller.abort();
    return TIMEOUT;
  });

  let res: Response;
  try {
    const raced = await Promise.race([
      fetchImpl(url.toString(), {
        headers: { accept: "application/json" },
        redirect: "manual",
        signal: controller.signal,
      }),
      timer,
    ]);
    if (raced === TIMEOUT) {
      throw new BootstrapError("Timed out fetching IANA RDAP bootstrap");
    }
    res = raced as Response;
  } catch (err) {
    if (err instanceof BootstrapError) throw err;
    if (controller.signal.aborted) {
      throw new BootstrapError("Timed out fetching IANA RDAP bootstrap");
    }
    throw new BootstrapError(
      `Failed to fetch IANA RDAP bootstrap: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!res.ok) {
    throw new BootstrapError(`IANA RDAP bootstrap returned HTTP ${res.status}`);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new BootstrapError("IANA RDAP bootstrap was not valid JSON");
  }
  return parseBootstrapServices(json, now());
}
