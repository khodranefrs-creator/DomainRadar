// Shared types for the RDAP adapter layer.

import type { AvailabilityStatus, ErrorKind } from "../enums";

/** Parsed IANA RDAP bootstrap (dns.json): TLD (no dot) -> published base URLs. */
export interface BootstrapMap {
  fetchedAt: number;
  source: string;
  services: Map<string, string[]>;
}

/** Minimal rate-limiter contract so the client can be tested in isolation. */
export interface RateLimiterLike {
  acquire(key: string): Promise<void>;
}

/** Normalized result of a single RDAP domain lookup. */
export interface RdapOutcome {
  fqdn: string;
  status: AvailabilityStatus;
  httpStatus: number | null;
  rawStatus: string | null;
  errorKind: ErrorKind | null;
  errorDetails: string | null;
  responseMs: number | null;
  providerHost: string | null;
  requestUrl: string | null;
  attempts: number;
  retryAfterMs: number | null;
}

export interface RdapLookupOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  delay?: Sleeper;
  timeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  rateLimiter?: RateLimiterLike;
  signal?: AbortSignal;
  maxBodyBytes?: number;
}

export type Sleeper = (ms: number) => Promise<void>;
