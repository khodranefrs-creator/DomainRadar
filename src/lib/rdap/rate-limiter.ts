// Per-provider rate limiting. Requests to the same provider host are serialized
// so we never exceed the configured minimum interval between calls. No provider
// documents an RDAP rate limit, so the default is deliberately conservative
// (one request per second per host) and can be tightened per source.

import type { RateLimiterLike, Sleeper } from "./types";

export type Clock = () => number;

export const defaultDelay: Sleeper = (ms) =>
  new Promise((resolve) => {
    if (ms <= 0) resolve();
    else setTimeout(resolve, ms);
  });

export class RateLimiter implements RateLimiterLike {
  private minIntervalMs: number;
  private readonly now: Clock;
  private readonly delay: Sleeper;
  private readonly lastAt = new Map<string, number>();
  private readonly chains = new Map<string, Promise<void>>();

  constructor(
    minIntervalMs: number,
    opts: { now?: Clock; delay?: Sleeper } = {},
  ) {
    this.minIntervalMs = Math.max(0, minIntervalMs);
    this.now = opts.now ?? Date.now;
    this.delay = opts.delay ?? defaultDelay;
  }

  getMinIntervalMs(): number {
    return this.minIntervalMs;
  }

  setMinIntervalMs(ms: number): void {
    this.minIntervalMs = Math.max(0, ms);
  }

  async acquire(key: string): Promise<void> {
    // Serialize per key: each caller waits for the previous chain to finish.
    const prior = this.chains.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.chains.set(
      key,
      prior.then(() => current),
    );
    await prior;
    try {
      const last = this.lastAt.get(key);
      if (last !== undefined) {
        const wait = this.minIntervalMs - (this.now() - last);
        if (wait > 0) await this.delay(wait);
      }
      this.lastAt.set(key, this.now());
    } finally {
      release();
    }
  }
}
