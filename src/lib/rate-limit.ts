// Best-effort abuse controls for the public deployment.
//
// This is an in-memory sliding-window limiter. On a serverless host each
// instance keeps its own counters, so it throttles bursts per instance rather
// than enforcing a global quota — it is a first line of defence, not a
// substitute for a shared store if the app ever needs strict global limits.
//
// Deliberately free of Next.js imports so the logic can be unit tested.

export type Clock = () => number;

export interface RateLimitRule {
  /** Window length in milliseconds. */
  readonly windowMs: number;
  /** Maximum number of allowed hits within the window. */
  readonly max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Hits left in the current window (0 when blocked). */
  remaining: number;
  /** Milliseconds until the caller may retry (0 when allowed). */
  retryAfterMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly now: Clock;
  private readonly hits = new Map<string, number[]>();

  constructor(opts: { now?: Clock } = {}) {
    this.now = opts.now ?? Date.now;
  }

  check(key: string, rule: RateLimitRule): RateLimitResult {
    const now = this.now();
    const windowStart = now - rule.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((at) => at > windowStart);

    if (recent.length >= rule.max) {
      this.hits.set(key, recent);
      const oldest = recent[0];
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, oldest + rule.windowMs - now),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return {
      allowed: true,
      remaining: Math.max(0, rule.max - recent.length),
      retryAfterMs: 0,
    };
  }

  reset(key?: string): void {
    if (key === undefined) this.hits.clear();
    else this.hits.delete(key);
  }
}

/**
 * Identify the caller for rate limiting. Behind Vercel/any reverse proxy the
 * first `x-forwarded-for` entry is the client; `x-real-ip` is the fallback.
 * Falls back to "unknown" so a missing header cannot bypass limiting entirely.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return "unknown";
}

// Per-bucket limits. The RDAP scan is the most expensive (outbound requests to
// registries) so it is the tightest; writes are moderately capped.
export const RATE_LIMITS = {
  search: { windowMs: 60_000, max: 20 },
  candidatesImport: { windowMs: 60_000, max: 5 },
  candidatesWrite: { windowMs: 60_000, max: 60 },
  settingsWrite: { windowMs: 60_000, max: 20 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

const limiter = new SlidingWindowRateLimiter();

/** Apply a named limit to a request, keyed by client IP + bucket. */
export function rateLimit(
  request: Request,
  bucket: RateLimitBucket,
): RateLimitResult {
  const key = `${bucket}:${getClientIp(request.headers)}`;
  return limiter.check(key, RATE_LIMITS[bucket]);
}

/** Standard 429 response with a `Retry-After` header (in seconds). */
export function tooManyRequests(result: RateLimitResult): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down and try again shortly.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}

/** Testing seam: clear all counters. */
export function resetRateLimits(): void {
  limiter.reset();
}
