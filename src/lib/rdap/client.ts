// RDAP domain lookup client. Server-side only.
//
// - URL is built from a discovered provider base + the validated domain, never
//   from user input.
// - Every request goes through assertAllowedUrl (SSRF allowlist, https only).
// - Per-provider rate limiting, timeouts, and bounded retry with backoff for
//   transient failures (429 / 5xx / network).

import { parseDomain } from "../domain";
import { AvailabilityStatus, ErrorKind } from "../enums";
import { assertAllowedUrl, SsrfError } from "../ssrf";
import { normalizeBaseUrl } from "./bootstrap";
import {
  classifyTransportError,
  isRetriableStatus,
  mapHttpResponse,
} from "./mapping";
import { defaultDelay } from "./rate-limiter";
import type { RdapLookupOptions, RdapOutcome, Sleeper } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_RETRY_MS = 500;
const DEFAULT_MAX_RETRY_MS = 8_000;
const DEFAULT_MAX_BODY_BYTES = 262_144;

const TIMEOUT = Symbol("rdap-timeout");

type Attempt =
  | { kind: "response"; res: Response }
  | { kind: "error"; error: unknown }
  | { kind: "timeout" };

/** Build the RDAP domain query URL from a discovered base and a validated FQDN. */
export function buildRdapDomainUrl(baseUrl: string, fqdn: string): string {
  return new URL(`domain/${fqdn}`, normalizeBaseUrl(baseUrl)).toString();
}

/** Parse a Retry-After header (delta-seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(header: string | null, now: number): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) return Math.max(0, date - now);
  return null;
}

/** Exponential backoff, clamped; an explicit Retry-After always wins. */
export function computeBackoffMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
  retryAfterMs: number | null,
): number {
  if (retryAfterMs != null) return Math.min(maxMs, Math.max(0, retryAfterMs));
  return Math.min(maxMs, baseMs * 2 ** attempt);
}

function baseOutcome(fqdn: string): RdapOutcome {
  return {
    fqdn,
    status: AvailabilityStatus.ERROR,
    httpStatus: null,
    rawStatus: null,
    errorKind: null,
    errorDetails: null,
    responseMs: null,
    providerHost: null,
    requestUrl: null,
    attempts: 0,
    retryAfterMs: null,
  };
}

export async function rdapLookupDomain(
  fqdnInput: string,
  baseUrl: string,
  options: RdapLookupOptions = {},
): Promise<RdapOutcome> {
  const now = options.now ?? Date.now;
  const delay = options.delay ?? defaultDelay;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);
  const baseRetryMs = options.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_MS;
  const maxRetryMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  const parsed = parseDomain(fqdnInput);
  if (!parsed) {
    return {
      ...baseOutcome(fqdnInput.toLowerCase()),
      status: AvailabilityStatus.ERROR,
      errorKind: ErrorKind.MALFORMED,
      errorDetails: `Invalid domain: ${fqdnInput}`,
    };
  }

  let url: URL;
  try {
    url = assertAllowedUrl(buildRdapDomainUrl(baseUrl, parsed.fqdn));
  } catch (err) {
    const { errorKind, detail } = classifyTransportError(err);
    return {
      ...baseOutcome(parsed.fqdn),
      status: AvailabilityStatus.ERROR,
      errorKind: err instanceof SsrfError ? ErrorKind.SSRF_BLOCKED : errorKind,
      errorDetails: detail,
    };
  }

  const providerHost = url.hostname;
  const requestUrl = url.toString();
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;
    if (options.rateLimiter) await options.rateLimiter.acquire(providerHost);

    const started = now();
    const result = await attemptOnce(
      fetchImpl,
      requestUrl,
      timeoutMs,
      delay,
      options.signal,
    );
    const responseMs = Math.max(0, now() - started);

    if (result.kind === "timeout") {
      if (attempt < maxRetries) {
        await delay(computeBackoffMs(attempt, baseRetryMs, maxRetryMs, null));
        continue;
      }
      return {
        ...baseOutcome(parsed.fqdn),
        status: AvailabilityStatus.ERROR,
        errorKind: ErrorKind.TIMEOUT,
        errorDetails: `Timed out after ${timeoutMs}ms.`,
        responseMs,
        providerHost,
        requestUrl,
        attempts,
      };
    }

    if (result.kind === "error") {
      const { errorKind, detail } = classifyTransportError(result.error);
      const retriable = errorKind === ErrorKind.NETWORK;
      if (retriable && attempt < maxRetries) {
        await delay(computeBackoffMs(attempt, baseRetryMs, maxRetryMs, null));
        continue;
      }
      return {
        ...baseOutcome(parsed.fqdn),
        status: AvailabilityStatus.ERROR,
        errorKind,
        errorDetails: detail,
        responseMs,
        providerHost,
        requestUrl,
        attempts,
      };
    }

    const { res } = result;
    const bodyText = await readBoundedText(res, maxBodyBytes);
    const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"), now());
    const mapped = mapHttpResponse(res.status, bodyText);
    const outcome: RdapOutcome = {
      ...baseOutcome(parsed.fqdn),
      status: mapped.status,
      httpStatus: res.status,
      rawStatus: mapped.rawStatus,
      errorKind: mapped.errorKind,
      errorDetails: mapped.errorKind ? mapped.detail : null,
      responseMs,
      providerHost,
      requestUrl,
      attempts,
      retryAfterMs,
    };

    if (isRetriableStatus(res.status) && attempt < maxRetries) {
      await delay(computeBackoffMs(attempt, baseRetryMs, maxRetryMs, retryAfterMs));
      continue;
    }
    return outcome;
  }

  return {
    ...baseOutcome(parsed.fqdn),
    status: AvailabilityStatus.UNKNOWN,
    errorKind: ErrorKind.UNKNOWN,
    errorDetails: "Exhausted retries without a definitive result.",
    providerHost,
    requestUrl,
    attempts,
  };
}

async function attemptOnce(
  fetchImpl: typeof fetch,
  requestUrl: string,
  timeoutMs: number,
  delay: Sleeper,
  externalSignal?: AbortSignal,
): Promise<Attempt> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onAbort, { once: true });
  }
  let timedOut = false;
  const timer = delay(timeoutMs).then(() => {
    timedOut = true;
    controller.abort();
    return TIMEOUT;
  });

  try {
    const raced = await Promise.race([
      fetchImpl(requestUrl, {
        method: "GET",
        redirect: "manual",
        headers: { accept: "application/rdap+json, application/json" },
        signal: controller.signal,
      }),
      timer,
    ]);
    if (raced === TIMEOUT) return { kind: "timeout" };
    return { kind: "response", res: raced as Response };
  } catch (error) {
    if (timedOut) return { kind: "timeout" };
    return { kind: "error", error };
  } finally {
    if (externalSignal) externalSignal.removeEventListener("abort", onAbort);
  }
}

async function readBoundedText(
  res: Response,
  maxBytes: number,
): Promise<string | null> {
  try {
    if (!res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let out = "";
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        out += decoder.decode(value, { stream: true });
        if (received >= maxBytes) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          break;
        }
      }
    }
    out += decoder.decode();
    return out.slice(0, maxBytes);
  } catch {
    return null;
  }
}
