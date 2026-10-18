import { describe, it, expect } from "vitest";
import {
  runSearch,
  type SearchDeps,
  type TldInfo,
  type VariantCheckRecord,
  type SessionCounts,
} from "@/lib/rdap/service";
import type { BootstrapMap, RdapOutcome } from "@/lib/rdap/types";

const NOW = 1_700_000_000_000;

function baseOutcome(
  fqdn: string,
  status: RdapOutcome["status"],
  extra: Partial<RdapOutcome> = {},
): RdapOutcome {
  return {
    fqdn,
    status,
    httpStatus: null,
    rawStatus: null,
    errorKind: null,
    errorDetails: null,
    responseMs: 5,
    providerHost: null,
    requestUrl: null,
    attempts: 1,
    retryAfterMs: null,
    ...extra,
  };
}

const BOOTSTRAP: BootstrapMap = {
  fetchedAt: NOW,
  source: "test",
  services: new Map<string, string[]>([
    ["com", ["https://rdap.verisign.com/com/v1/"]],
    ["ai", ["https://rdap.identitydigital.services/rdap/"]],
    ["si", ["https://rdap.register.si/"]],
  ]),
};

const TLDS: TldInfo[] = [
  { id: "tld-com", tld: ".com", status: "AVAILABLE", rdapBaseUrl: "https://rdap.verisign.com/com/v1/", registryName: "Verisign" },
  { id: "tld-ai", tld: ".ai", status: "AVAILABLE", rdapBaseUrl: "https://rdap.identitydigital.services/rdap/", registryName: "Identity Digital" },
  { id: "tld-si", tld: ".si", status: "AVAILABLE", rdapBaseUrl: "https://rdap.register.si/", registryName: "Register.si" },
  { id: "tld-co", tld: ".co", status: "UNSUPPORTED", rdapBaseUrl: null, registryName: null },
  { id: "tld-xyz", tld: ".xyz", status: "NEEDS_VERIFICATION", rdapBaseUrl: null, registryName: null },
  { id: "tld-foo", tld: ".foo", status: "AVAILABLE", rdapBaseUrl: null, registryName: "Foo Registry" },
];

interface Harness {
  deps: SearchDeps;
  saved: VariantCheckRecord[];
  finalized: Array<SessionCounts & { status: string }>;
  lookupCalls: string[];
}

function makeDeps(opts: {
  lookupResults: Record<string, RdapOutcome>;
  fresh?: Record<
    string,
    { normalizedStatus: string; httpStatus: number | null; checkedAt: Date }
  >;
}): Harness {
  const saved: VariantCheckRecord[] = [];
  const finalized: Array<SessionCounts & { status: string }> = [];
  const lookupCalls: string[] = [];
  const deps: SearchDeps = {
    now: () => NOW,
    delay: async () => {},
    defaultMinIntervalMs: 0,
    maxConcurrency: 3,
    loadTlds: async (requested) => TLDS.filter((t) => requested.includes(t.tld)),
    loadBootstrapMap: async () => BOOTSTRAP,
    ensureSource: async (host) => ({
      id: `src:${host}`,
      key: `key:${host}`,
      name: `RDAP ${host}`,
      cacheTtlSeconds: 3600,
      timeoutMs: 1000,
      maxRetries: 0,
      rateLimitPerMinute: null,
    }),
    findFreshCheck: async (fqdn) => opts.fresh?.[fqdn] ?? null,
    saveVariantCheck: async (record) => {
      saved.push(record);
    },
    createSession: async () => ({ id: "session-1" }),
    finalizeSession: async (_id, data) => {
      finalized.push(data);
    },
    lookup: async (fqdn) => {
      lookupCalls.push(fqdn);
      const result = opts.lookupResults[fqdn];
      if (!result) throw new Error(`no fake result for ${fqdn}`);
      return result;
    },
  };
  return { deps, saved, finalized, lookupCalls };
}

describe("runSearch", () => {
  it("aggregates a multi-TLD search with partial failures", async () => {
    const h = makeDeps({
      lookupResults: {
        "agentcapability.com": baseOutcome("agentcapability.com", "REGISTERED", {
          httpStatus: 200,
          providerHost: "rdap.verisign.com",
          requestUrl: "https://rdap.verisign.com/com/v1/domain/agentcapability.com",
          rawStatus: "client transfer prohibited",
        }),
        "agentcapability.ai": baseOutcome("agentcapability.ai", "NOT_FOUND", {
          httpStatus: 404,
          providerHost: "rdap.identitydigital.services",
          requestUrl: "https://rdap.identitydigital.services/rdap/domain/agentcapability.ai",
        }),
        "agentcapability.si": baseOutcome("agentcapability.si", "ERROR", {
          httpStatus: 503,
          errorKind: "SERVER_ERROR",
          errorDetails: "Provider server error (HTTP 503).",
          providerHost: "rdap.register.si",
          requestUrl: "https://rdap.register.si/domain/agentcapability.si",
        }),
      },
    });

    const summary = await runSearch(
      {
        rawQuery: "AgentCapability",
        sld: "agentcapability",
        requestedTlds: [".com", ".ai", ".si", ".co", ".xyz", ".foo"],
      },
      h.deps,
    );

    expect(summary.requestedCount).toBe(6);
    expect(summary.checkedCount).toBe(2);
    expect(summary.registeredCount).toBe(1);
    expect(summary.notFoundCount).toBe(1);
    expect(summary.unsupportedCount).toBe(2); // .co (unsupported) + .foo (no base)
    expect(summary.unresolvedCount).toBe(1); // .xyz NEEDS_VERIFICATION
    expect(summary.errorCount).toBe(1); // .si server error
    expect(summary.status).toBe("PARTIAL");

    expect(h.lookupCalls.sort()).toEqual([
      "agentcapability.ai",
      "agentcapability.com",
      "agentcapability.si",
    ]);

    const com = h.saved.find((s) => s.fqdn === "agentcapability.com");
    expect(h.saved).toHaveLength(3);
    expect(com?.providerHost).toBe("rdap.verisign.com");
    expect(h.saved.find((s) => s.fqdn === "agentcapability.com")?.requestUrl).toContain(
      "/domain/agentcapability.com",
    );

    expect(h.finalized).toHaveLength(1);
    expect(h.finalized[0]).toMatchObject({
      registeredCount: 1,
      notFoundCount: 1,
      unsupportedCount: 2,
      errorCount: 1,
      status: "PARTIAL",
    });
  });

  it("reports NOT_FOUND as registry state, never as available", async () => {
    const h = makeDeps({
      lookupResults: {
        "agentcapability.com": baseOutcome("agentcapability.com", "NOT_FOUND", {
          httpStatus: 404,
        }),
      },
    });
    const summary = await runSearch(
      { rawQuery: "AgentCapability", sld: "agentcapability", requestedTlds: [".com"] },
      h.deps,
    );
    expect(summary.variants[0].status).toBe("NOT_FOUND");
    expect(summary.notFoundCount).toBe(1);
    expect(summary.registeredCount).toBe(0);
    expect(summary.note.toLowerCase()).toContain("not proof");
  });

  it("serves a cached result without a lookup", async () => {
    const h = makeDeps({
      lookupResults: {},
      fresh: {
        "agentcapability.com": {
          normalizedStatus: "REGISTERED",
          httpStatus: 200,
          checkedAt: new Date(NOW - 1000),
        },
      },
    });
    const summary = await runSearch(
      { rawQuery: "x", sld: "agentcapability", requestedTlds: [".com"] },
      h.deps,
    );
    expect(h.lookupCalls).toEqual([]);
    expect(summary.variants[0].cached).toBe(true);
    expect(summary.variants[0].status).toBe("REGISTERED");
    expect(summary.checkedCount).toBe(1);
  });

  it("reports a TLD that is not registered without a lookup", async () => {
    const h = makeDeps({ lookupResults: {} });
    const summary = await runSearch(
      { rawQuery: "x", sld: "agentcapability", requestedTlds: [".zzz"] },
      h.deps,
    );
    expect(summary.variants[0].status).toBe("UNKNOWN_TLD");
    expect(summary.unresolvedCount).toBe(1);
    expect(h.lookupCalls).toEqual([]);
  });

  it("reports an explicitly unsupported TLD without a lookup", async () => {
    const h = makeDeps({ lookupResults: {} });
    const summary = await runSearch(
      { rawQuery: "x", sld: "agentcapability", requestedTlds: [".co"] },
      h.deps,
    );
    expect(summary.variants[0].status).toBe("UNSUPPORTED");
    expect(summary.unsupportedCount).toBe(1);
    expect(h.lookupCalls).toEqual([]);
  });

  it("marks a fully checked session COMPLETED", async () => {
    const h = makeDeps({
      lookupResults: {
        "agentcapability.com": baseOutcome("agentcapability.com", "REGISTERED", { httpStatus: 200 }),
        "agentcapability.ai": baseOutcome("agentcapability.ai", "NOT_FOUND", { httpStatus: 404 }),
      },
    });
    const summary = await runSearch(
      { rawQuery: "x", sld: "agentcapability", requestedTlds: [".com", ".ai"] },
      h.deps,
    );
    expect(summary.status).toBe("COMPLETED");
    expect(summary.errorCount).toBe(0);
  });
});
