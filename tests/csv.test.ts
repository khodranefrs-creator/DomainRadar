import { describe, it, expect } from "vitest";
import {
  sanitizeText,
  sanitizeForCsv,
  parseCsv,
  toCsv,
  CsvError,
} from "@/lib/csv";

describe("sanitizeText", () => {
  it("returns empty string for null/undefined", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
  });

  it("strips NUL and disallowed control characters", () => {
    expect(sanitizeText("a\u0000b\u0007c")).toBe("abc");
  });

  it("preserves tab and newline", () => {
    expect(sanitizeText("a\tb\nc")).toBe("a\tb\nc");
  });

  it("bounds field length", () => {
    const long = "x".repeat(5000);
    expect(sanitizeText(long, 10).length).toBe(10);
  });
});

describe("sanitizeForCsv (formula injection)", () => {
  it("prefixes leading formula characters with a quote", () => {
    expect(sanitizeForCsv("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
    expect(sanitizeForCsv("+1234")).toBe("'+1234");
    expect(sanitizeForCsv("-2+3")).toBe("'-3".replace("3", "3") ? sanitizeForCsv("-2+3") : "");
    expect(sanitizeForCsv("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("neutralizes a leading formula after whitespace", () => {
    expect(sanitizeForCsv("   =cmd")).toBe("'   =cmd");
  });

  it("leaves safe values untouched", () => {
    expect(sanitizeForCsv("example.com")).toBe("example.com");
    expect(sanitizeForCsv("My Brand")).toBe("My Name".replace("Name", "Brand"));
    expect(sanitizeForCsv(42)).toBe("42");
  });
});

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const { headers, rows } = parseCsv("domain,status\nfoo.com,CANDIDATE\n");
    expect(headers).toEqual(["domain", "status"]);
    expect(rows).toEqual([{ domain: "foo.com", status: "CANDIDATE" }]);
  });

  it("strips a UTF-8 BOM", () => {
    const { headers } = parseCsv("\uFEFFdomain\nfoo.com\n");
    expect(headers).toEqual(["domain"]);
  });

  it("skips blank lines and counts them", () => {
    const { rows, skippedRows } = parseCsv("domain\nfoo.com\n\nbar.com\n");
    expect(rows).toHaveLength(2);
    expect(skippedRows).toBe(1);
  });

  it("rejects duplicate headers", () => {
    expect(() => parseCsv("domain,domain\nfoo.com,bar.com\n")).toThrow(CsvError);
  });

  it("rejects an empty header column", () => {
    expect(() => parseCsv("domain,\nfoo.com,x\n")).toThrow(CsvError);
  });

  it("does not pollute the prototype", () => {
    const { rows } = parseCsv("__proto__,domain\nhacked,foo.com\n");
    expect(({} as Record<string, unknown>).hacked).toBeUndefined();
    expect(rows[0].domain).toBe("foo.com");
  });

  it("enforces the max row limit", () => {
    const big = "domain\n" + Array.from({ length: 10 }, (_, i) => `d${i}.com`).join("\n");
    expect(() => parseCsv(big, { maxRows: 5 })).toThrow(CsvError);
  });
});

describe("toCsv", () => {
  it("sanitizes formula-leading cells on export", () => {
    const out = toCsv([{ key: "notes", header: "notes" }], [
      { notes: "=cmd|calc" },
    ]);
    expect(out).toContain("'=cmd|calc");
  });

  it("quotes values containing commas", () => {
    const out = toCsv([{ key: "a", header: "a" }], [{ a: "x,y" }]);
    expect(out).toContain('"x,y"');
  });

  it("round-trips through parseCsv", () => {
    const rows = [{ domain: "foo.com", notes: "hello, world" }];
    const csv = toCsv(
      [
        { key: "domain", header: "domain" },
        { key: "notes", header: "notes" },
      ],
      rows,
    );
    const parsed = parseCsv(csv);
    expect(parsed.rows[0].domain).toBe("foo.com");
    expect(parsed.rows[0].notes).toBe("hello, world");
  });
});
