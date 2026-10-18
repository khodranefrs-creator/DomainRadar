import { describe, it, expect } from "vitest";
import { userSettingsSchema, candidateCreateSchema } from "@/lib/schemas";
import { TLD_CATALOG } from "@/lib/tld-catalog";
import { SOURCE_CATALOG } from "@/lib/source-catalog";

describe("userSettingsSchema", () => {
  const valid = {
    defaultTlds: [".com", ".ai", ".si"],
    requestBudgetPerRun: 200,
    maxConcurrency: 2,
    requestDelayMs: 1000,
    fxRateSource: "manual",
    theme: "dark",
  };

  it("accepts valid settings and normalizes TLDs", () => {
    const parsed = userSettingsSchema.parse({
      ...valid,
      defaultTlds: ["COM", ".ai", ".si", ".ai"],
    });
    expect(parsed.defaultTlds).toEqual([".com", ".ai", ".si"]);
  });

  it("coerces numeric strings", () => {
    const parsed = userSettingsSchema.parse({
      ...valid,
      requestBudgetPerRun: "50",
      maxConcurrency: "3",
    });
    expect(parsed.requestBudgetPerRun).toBe(50);
    expect(parsed.maxConcurrency).toBe(3);
  });

  it("requires at least one TLD", () => {
    expect(() => userSettingsSchema.parse({ ...valid, defaultTlds: [] })).toThrow();
  });

  it("rejects out-of-range concurrency", () => {
    expect(() =>
      userSettingsSchema.parse({ ...valid, maxConcurrency: 99 }),
    ).toThrow();
  });

  it("rejects unknown theme", () => {
    expect(() =>
      userSettingsSchema.parse({ ...valid, theme: "neon" }),
    ).toThrow();
  });
});

describe("candidateCreateSchema", () => {
  it("defaults status to CANDIDATE", () => {
    const parsed = candidateCreateSchema.parse({ domain: "agentcapability.com" });
    expect(parsed.status).toBe("CANDIDATE");
  });

  it("rejects unknown status", () => {
    expect(() =>
      candidateCreateSchema.parse({ domain: "x.com", status: "MAYBE" }),
    ).toThrow();
  });
});

describe("catalog invariants", () => {
  it("every AVAILABLE TLD has a verified rdapBaseUrl and verifiedAt", () => {
    for (const t of TLD_CATALOG) {
      if (t.status === "AVAILABLE") {
        expect(t.rdapBaseUrl, `${t.tld} must have rdapBaseUrl`).toBeTruthy();
        expect(t.verifiedAt, `${t.tld} must have verifiedAt`).toBeTruthy();
      }
    }
  });

  it("every UNSUPPORTED TLD has no rdapBaseUrl", () => {
    for (const t of TLD_CATALOG) {
      if (t.status === "UNSUPPORTED") {
        expect(t.rdapBaseUrl, `${t.tld} must not claim an endpoint`).toBeNull();
      }
    }
  });

  it("TLD strings are unique and leading-dot", () => {
    const seen = new Set<string>();
    for (const t of TLD_CATALOG) {
      expect(t.tld.startsWith(".")).toBe(true);
      expect(seen.has(t.tld)).toBe(false);
      seen.add(t.tld);
    }
  });

  it("prioritizes .com, .ai and .si as defaults", () => {
    const defaults = TLD_CATALOG.filter((t) => t.isDefault).map((t) => t.tld);
    expect(defaults).toEqual(expect.arrayContaining([".com", ".ai", ".si"]));
  });

  it("source keys are unique", () => {
    const seen = new Set<string>();
    for (const s of SOURCE_CATALOG) {
      expect(seen.has(s.key)).toBe(false);
      seen.add(s.key);
    }
  });

  it("NameBio free sources declare the 4/min rate limit and attribution", () => {
    const nb = SOURCE_CATALOG.filter((s) => s.key.startsWith("namebio_"));
    expect(nb.length).toBeGreaterThan(0);
    for (const s of nb) {
      expect(s.rateLimitPerMinute).toBe(4);
      expect(s.attributionRequired).toBe(true);
    }
  });

  it("trademark portals are MANUAL_ONLY", () => {
    const portals = SOURCE_CATALOG.filter((s) =>
      ["tmview", "wipo_global_brand_db"].includes(s.key),
    );
    expect(portals).toHaveLength(2);
    for (const p of portals) expect(p.status).toBe("MANUAL_ONLY");
  });
});
