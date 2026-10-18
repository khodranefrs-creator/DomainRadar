import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseBootstrapServices,
  bootstrapBasesFor,
  loadBootstrap,
  clearBootstrapCache,
  getBootstrapCacheInfo,
  BootstrapError,
} from "@/lib/rdap/bootstrap";

const SAMPLE = {
  services: [
    [["com", "net"], ["https://rdap.verisign.com/com/v1/", "https://rdap.verisign.com/net/v1/"]],
    [["si"], ["https://rdap.register.si/"]],
    [["kg"], ["http://rdap.cctld.kg/"]],
  ],
};

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("parseBootstrapServices", () => {
  it("maps TLDs (without dot) to published base URLs", () => {
    const map = parseBootstrapServices(SAMPLE, 123);
    expect(map.fetchedAt).toBe(123);
    expect(map.services.get("com")).toEqual([
      "https://rdap.verisign.com/com/v1/",
      "https://rdap.verisign.com/net/v1/",
    ]);
    expect(map.services.get("kg")).toEqual(["http://rdap.cctld.kg/"]);
  });

  it("throws on malformed payloads", () => {
    expect(() => parseBootstrapServices({}, 0)).toThrow(BootstrapError);
    expect(() => parseBootstrapServices({ services: [] }, 0)).toThrow(BootstrapError);
  });
});

describe("bootstrapBasesFor", () => {
  const map = parseBootstrapServices(SAMPLE, 0);

  it("returns normalized https bases using dotless or dotted input", () => {
    expect(bootstrapBasesFor(map, ".si")).toEqual(["https://rdap.register.si/"]);
    expect(bootstrapBasesFor(map, "si")).toEqual(["https://rdap.register.si/"]);
  });

  it("excludes non-https services and unknown TLDs", () => {
    expect(bootstrapBasesFor(map, ".kg")).toEqual([]);
    expect(bootstrapBasesFor(map, ".co")).toEqual([]);
    expect(bootstrapBasesFor(null, ".com")).toEqual([]);
  });
});

describe("loadBootstrap", () => {
  beforeEach(() => clearBootstrapCache());

  it("memoizes the fetch across calls", async () => {
    const fetchImpl = vi.fn(async () => okResponse(SAMPLE));
    const now = () => 1000;
    await loadBootstrap({ fetchImpl: fetchImpl as unknown as typeof fetch, now });
    await loadBootstrap({ fetchImpl: fetchImpl as unknown as typeof fetch, now });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getBootstrapCacheInfo().cached).toBe(true);
    expect(getBootstrapCacheInfo().tldCount).toBe(4);
  });

  it("refetches when forced or expired", async () => {
    let clock = 0;
    const fetchImpl = vi.fn(async () => okResponse(SAMPLE));
    await loadBootstrap({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => clock,
    });
    clock = 10;
    await loadBootstrap({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => clock,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await loadBootstrap({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => clock,
      force: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("surfaces HTTP failures as BootstrapError", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503 }));
    await expect(
      loadBootstrap({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(BootstrapError);
  });

  it("times out a hanging bootstrap fetch", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    await expect(
      loadBootstrap({
        fetchImpl: fetchImpl as unknown as typeof fetch,
        delay: async () => {},
        timeoutMs: 10,
      }),
    ).rejects.toThrow(/Timed out/);
  });
});
