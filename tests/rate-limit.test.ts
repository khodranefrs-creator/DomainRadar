import { describe, expect, it } from "vitest";
import {
  getClientIp,
  SlidingWindowRateLimiter,
  tooManyRequests,
} from "@/lib/rate-limit";

describe("SlidingWindowRateLimiter", () => {
  it("blocks a burst past the limit", () => {
    const limiter = new SlidingWindowRateLimiter({ now: () => 0 });
    const rule = { windowMs: 1000, max: 2 };

    expect(limiter.check("k", rule).allowed).toBe(true);
    expect(limiter.check("k", rule).allowed).toBe(true);
    const blocked = limiter.check("k", rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("frees capacity once the window slides", () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter({ now: () => now });
    const rule = { windowMs: 1000, max: 2 };

    expect(limiter.check("k", rule).allowed).toBe(true);
    expect(limiter.check("k", rule).allowed).toBe(true);
    expect(limiter.check("k", rule).allowed).toBe(false);

    now = 1001;
    expect(limiter.check("k", rule).allowed).toBe(true);
  });

  it("keys limits independently", () => {
    const limiter = new SlidingWindowRateLimiter({ now: () => 0 });
    const rule = { windowMs: 1000, max: 1 };

    expect(limiter.check("a", rule).allowed).toBe(true);
    expect(limiter.check("a", rule).allowed).toBe(false);
    expect(limiter.check("b", rule).allowed).toBe(true);
  });

  it("reports remaining hits", () => {
    const limiter = new SlidingWindowRateLimiter({ now: () => 0 });
    const result = limiter.check("k", { windowMs: 1000, max: 3 });
    expect(result).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
  });

  it("reset clears a key", () => {
    const limiter = new SlidingWindowRateLimiter({ now: () => 0 });
    const rule = { windowMs: 1000, max: 1 };
    limiter.check("k", rule);
    expect(limiter.check("k", rule).allowed).toBe(false);
    limiter.reset("k");
    expect(limiter.check("k", rule).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the first forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("falls back to a constant when nothing is present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("tooManyRequests", () => {
  it("returns a 429 with Retry-After in seconds", () => {
    const response = tooManyRequests({
      allowed: false,
      remaining: 0,
      retryAfterMs: 2500,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
  });

  it("never sends Retry-After below one second", () => {
    const response = tooManyRequests({
      allowed: false,
      remaining: 0,
      retryAfterMs: 0,
    });
    expect(response.headers.get("Retry-After")).toBe("1");
  });
});
