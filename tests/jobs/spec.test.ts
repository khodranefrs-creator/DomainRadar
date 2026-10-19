import { describe, it, expect } from "vitest";
import {
  planFromPaste,
  planFromCsv,
  splitTokens,
} from "@/lib/jobs/spec";

describe("splitTokens", () => {
  it("splits on newlines, commas, semicolons, tabs and spaces", () => {
    expect(splitTokens("a.com\nb.io, c.si;d.dev\te.ai")).toEqual([
      "a.com",
      "b.io",
      "c.si",
      "d.dev",
      "e.ai",
    ]);
  });

  it("drops empty tokens", () => {
    expect(splitTokens("  \n\n , ; ")).toEqual([]);
  });
});

describe("planFromPaste", () => {
  it("expands bare labels across every requested TLD", () => {
    const plan = planFromPaste("acme\nbeta", [".com", ".io"]);
    expect(plan.items).toEqual([
      { sld: "acme", tld: ".com" },
      { sld: "acme", tld: ".io" },
      { sld: "beta", tld: ".com" },
      { sld: "beta", tld: ".io" },
    ]);
    expect(plan.rejected).toHaveLength(0);
  });

  it("honours the explicit TLD of a pasted domain and ignores the matrix", () => {
    const plan = planFromPaste("acme.dev", [".com", ".io"]);
    expect(plan.items).toEqual([{ sld: "acme", tld: ".dev" }]);
  });

  it("deduplicates by fqdn and reports duplicates", () => {
    const plan = planFromPaste("acme.com\nACME.com\nacme", [".com"]);
    expect(plan.items).toEqual([
      { sld: "acme", tld: ".com" },
    ]);
    expect(plan.rejected.filter((r) => r.reason === "Duplicate domain")).toHaveLength(2);
  });

  it("rejects invalid labels honestly", () => {
    const plan = planFromPaste("-bad\nok.com\nno_such", [".com"]);
    const reasons = plan.rejected.map((r) => r.reason);
    expect(reasons).toContain("Not a valid label");
    expect(plan.items).toEqual([{ sld: "ok", tld: ".com" }]);
  });

  it("rejects bare labels when no TLD is selected", () => {
    const plan = planFromPaste("acme", []);
    expect(plan.items).toHaveLength(0);
    expect(plan.rejected[0].reason).toMatch(/No extensions selected/);
  });

  it("normalises TLD list (dedupe, dot form) and caps at maxTlds", () => {
    const plan = planFromPaste("acme", ["com", ".com", "io", "si"], {
      maxItems: 100,
      maxTlds: 2,
    });
    expect(plan.items.map((i) => i.tld)).toEqual([".com", ".io"]);
  });

  it("caps total items at maxItems and reports overflow", () => {
    const plan = planFromPaste("a\nb\nc\nd\ne", [".com", ".io"], {
      maxItems: 3,
      maxTlds: 2,
    });
    expect(plan.items).toHaveLength(3);
    expect(plan.overflow).toBe(7);
  });
});

describe("planFromCsv", () => {
  it("reads a domain column and expands bare labels", () => {
    const csv = "domain,notes\nacme.com,x\nbeta,y\n";
    const plan = planFromCsv(csv, [".io"]);
    expect(plan.items).toEqual([
      { sld: "acme", tld: ".com" },
      { sld: "beta", tld: ".io" },
    ]);
  });

  it("throws when the domain column is missing", () => {
    expect(() => planFromCsv("foo,bar\n1,2\n", [".com"])).toThrow(
      /Missing required column: domain/,
    );
  });

  it("counts blank rows as overflow/skipped", () => {
    const csv = "domain\nacme.com\n\nbeta.com\n";
    const plan = planFromCsv(csv, [".com"]);
    expect(plan.items).toHaveLength(2);
    expect(plan.overflow).toBeGreaterThanOrEqual(1);
  });

  it("deduplicates CSV domains", () => {
    const csv = "domain\nacme.com\nACME.COM\n";
    const plan = planFromCsv(csv, [".com"]);
    expect(plan.items).toHaveLength(1);
  });
});
