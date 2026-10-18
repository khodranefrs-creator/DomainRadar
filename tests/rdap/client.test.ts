import { describe, it, expect, vi } from "vitest";
import {
  rdapLookupDomain,
  buildRdapDomainUrl,
  parseRetryAfter,
  computeBackoffMs,
} from "@/lib/rdap/client";
import { RateLimiter } from "@/lib/rdap/rate-limiter";
import { AvailabilityStatus, ErrorKind } from "@/lib/enums";

const VERISIGN = "https://rdap.verisign.com/com/v1/";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/rdap+json" },
  });
}

const noopDelay = async () => {};
const immediateRateLimiter = new RateLimiter(0, { delay: noopDelay });
const DEFAULT_TIMEOUT_MS = 10_000;

// The client reuses the injected sleeper for its timeout timer. These helpers
// make that timer never resolve (so a fast provider decides the outcome) while
// still recording real backoff delays.
function neverTimeout(record?: (ms: number) => void) {
  return async (ms: number): Promise<void> => {
    if (ms === DEFAULT_TIMEOUT_MS) return new Promise<void>(() => {});
    record?.(ms);
  };
}

describe("buildRdapDomainUrl", () => {
  it("joins a base URL and validated FQDN", () => {
    expect(buildRdapDomainUrl(VERISIGN, "agentcapability.com")).toBe(
      "https://rdap.verisign.com/com/v1/domain/agentcapability.com",
    );
    expect(
      buildRdapDomainUrl("https://rdap.register.si", "agentcapability.si"),
    ).toBe("https://rdap.register.si/domain/agentcapability.si");
  });
});

describe("parseRetryAfter / computeBackoffMs", () => {
  it("parses seconds and HTTP dates", () => {
    expect(parseRetryAfter("2", 0)).toBe(2000);
    expect(parseRetryAfter(null, 0)).toBeNull();
    const future = new Date(Date.now() + 5000).toUTCString();
    expect(parseRetryAfter(future, Date.now())).toBeGreaterThan(0);
  });

  it("prefers Retry-After and otherwise backs off exponentially, clamped", () => {
    expect(computeBackoffMs(0, 500, 8000, 3000)).toBe(3000);
    expect(computeBackoffMs(0, 500, 8000, null)).toBe(500);
    expect(computeBackoffMs(1, 500, 8000, null)).toBe(1000);
    expect(computeBackoffMs(10, 500, 8000, null)).toBe(8000);
  });
});

describe("rdapLookupDomain", () => {
  it("returns REGISTERED for a 200 domain object", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ objectClassName: "domain", ldhName: "X.COM" }),
    );
    const outcome = await rdapLookupDomain("agentcapability.com", VERISIGN, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay: noopDelay,
      rateLimiter: immediateRateLimiter,
      now: () => 0,
    });
    expect(outcome.status).toBe(AvailabilityStatus.REGISTERED);
    expect(outcome.httpStatus).toBe(200);
    expect(outcome.requestUrl).toContain("/domain/agentcapability.com");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("parses a large RDAP body without truncating it", async () => {
    const payload = {
      objectClassName: "domain",
      ldhName: "AGENTCAPABILITY.COM",
      status: ["client transfer prohibited"],
      entities: Array.from({ length: 400 }, (_, i) => ({
        handle: `ENTITY-${i}`,
        roles: ["registrant"],
        vcardArray: ["vcard", [["fn", {}, "text", `Entity number ${i}`]]],
      })),
    };
    const body = JSON.stringify(payload);
    // Genuinely larger than the old 4 KB cap that truncated JSON mid-object.
    expect(body.length).toBeGreaterThan(20_000);
    const fetchImpl = vi.fn(async () => jsonResponse(payload));
    const outcome = await rdapLookupDomain("agentcapability.com", VERISIGN, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay: neverTimeout(),
      rateLimiter: immediateRateLimiter,
    });
    expect(outcome.status).toBe(AvailabilityStatus.REGISTERED);
  });

  it("returns NOT_FOUND for a 404 without retrying", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
    const outcome = await rdapLookupDomain("agentcapability.com", VERISIGN, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay: noopDelay,
      rateLimiter: immediateRateLimiter,
    });
    expect(outcome.status).toBe(AvailabilityStatus.NOT_FOUND);
    expect(outcome.httpStatus).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries transient 5xx then succeeds", async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call++;
      return call === 1
        ? new Response("boom", { status: 500 })
        : jsonResponse({ objectClassName: "domain" });
    });
    const delays: number[] = [];
    const outcome = await rdapLookupDomain("agentcapability.com", VERISIGN, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay: neverTimeout((ms) => delays.push(ms)),
      rateLimiter: immediateRateLimiter,
    });
    expect(outcome.status).toBe(AvailabilityStatus.REGISTERED);
    expect(outcome.attempts).toBe(2);
    expect(delays).toEqual([500]);
  });

  it("gives up after maxRetries on persistent 500", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));
    const outcome = await rdapLookupDomain("agentcapability.com", VERISIGN, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay: noopDelay,
      rateLimiter: immediateRateLimiter,
      maxRetries: 2,
    });
    expect(outcome.status).toBe(AvailabilityStatus.ERROR);
    expect(outcome.errorKind).toBe(ErrorKind.SERVER_ERROR);
    expect(outcome.attempts).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("honors Retry-After while retrying a 429 and ends RATE_LIMITED", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, { status: 429, headers: { "retry-after": "2" } }),
    );
    const delays: number[] = [];
    const outcome = await rdapLookupDomain("agentcapability.com", VERISIGN, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay: neverTimeout((ms) => delays.push(ms)),
      rateLimiter: immediateRateLimiter,
      maxRetries: 1,
    });
    expect(outcome.status).toBe(AvailabilityStatus.RATE_LIMITED);
    expect(outcome.retryAfterMs).toBe(2000);
    expect(delays).toEqual([2000]);
  });

  it("retries network errors and ends ERROR/NETWORK", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const outcome = await rdapLookupDomain("agentcapability.com", VERISIGN, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay: neverTimeout(),
      rateLimiter: immediateRateLimiter,
      maxRetries: 1,
    });
    expect(outcome.status).toBe(AvailabilityStatus.ERROR);
    expect(outcome.errorKind).toBe(ErrorKind.NETWORK);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns ERROR/TIMEOUT when the provider hangs", async () => {
    const fetchImpl = vi.fn(
      (url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    const outcome = await rdapLookupDomain("agentcapability.com", VERISIGN, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay: async () => {},
      rateLimiter: immediateRateLimiter,
      timeoutMs: 50,
      maxRetries: 0,
    });
    expect(outcome.status).toBe(AvailabilityStatus.ERROR);
    expect(outcome.errorKind).toBe(ErrorKind.TIMEOUT);
  });

  it("blocks non-allowlisted bases without making a request (SSRF)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const outcome = await rdapLookupDomain(
      "agentcapability.com",
      "https://evil.example.com/rdap/",
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        delay: noopDelay,
        rateLimiter: immediateRateLimiter,
      },
    );
    expect(outcome.status).toBe(AvailabilityStatus.ERROR);
    expect(outcome.errorKind).toBe(ErrorKind.SSRF_BLOCKED);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an invalid domain before any network call", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const outcome = await rdapLookupDomain("not a domain", VERISIGN, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delay: noopDelay,
      rateLimiter: immediateRateLimiter,
    });
    expect(outcome.errorKind).toBe(ErrorKind.MALFORMED);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
