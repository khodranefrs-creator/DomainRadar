import { describe, it, expect } from "vitest";
import { RateLimiter } from "@/lib/rdap/rate-limiter";

describe("RateLimiter", () => {
  it("waits the minimum interval between calls to the same key", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter(1000, {
      now: () => now,
      delay: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    });
    await limiter.acquire("h");
    await limiter.acquire("h");
    await limiter.acquire("h");
    expect(waits).toEqual([1000, 1000]);
  });

  it("does not delay across different keys", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter(1000, {
      now: () => now,
      delay: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    });
    await limiter.acquire("a");
    await limiter.acquire("b");
    expect(waits).toEqual([]);
  });

  it("serializes concurrent acquires for the same key in order", async () => {
    let now = 0;
    const order: number[] = [];
    const limiter = new RateLimiter(1000, {
      now: () => now,
      delay: async (ms) => {
        now += ms;
      },
    });
    const t1 = limiter.acquire("h").then(() => order.push(1));
    const t2 = limiter.acquire("h").then(() => order.push(2));
    const t3 = limiter.acquire("h").then(() => order.push(3));
    await Promise.all([t1, t2, t3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("derives interval from a per-minute budget", () => {
    expect(new RateLimiter(60_000 / 4).getMinIntervalMs()).toBe(15_000);
    expect(new RateLimiter(0).getMinIntervalMs()).toBe(0);
  });
});
