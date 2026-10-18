import { describe, it, expect } from "vitest";
import {
  isValidLabel,
  normalizeSld,
  normalizeTld,
  buildFqdn,
  parseDomain,
} from "@/lib/domain";

describe("isValidLabel", () => {
  it("accepts valid labels", () => {
    expect(isValidLabel("agentcapability")).toBe(true);
    expect(isValidLabel("a")).toBe(true);
    expect(isValidLabel("agent-capability")).toBe(true);
    expect(isValidLabel("x1")).toBe(true);
  });

  it("rejects invalid labels", () => {
    expect(isValidLabel("")).toBe(false);
    expect(isValidLabel("-lead")).toBe(false);
    expect(isValidLabel("trail-")).toBe(false);
    expect(isValidLabel("has space")).toBe(false);
    expect(isValidLabel("under_score")).toBe(false);
    expect(isValidLabel("a".repeat(64))).toBe(false);
  });
});

describe("normalizeSld", () => {
  it("lowercases and strips dots", () => {
    expect(normalizeSld("  AgentCapability.  ")).toBe("agentcapability");
  });

  it("returns null for invalid input", () => {
    expect(normalizeSld("bad name")).toBeNull();
    expect(normalizeSld("")).toBeNull();
  });
});

describe("normalizeTld", () => {
  it("normalizes to leading-dot lowercase", () => {
    expect(normalizeTld("SI")).toBe(".si");
    expect(normalizeTld(".com")).toBe(".com");
    expect(normalizeTld("COM")).toBe(".com");
  });

  it("returns null for invalid tld", () => {
    expect(normalizeTld("")).toBeNull();
    expect(normalizeTld("..")).toBeNull();
    expect(normalizeTld("co.uk")).toBeNull(); // multi-label TLDs not supported yet
    expect(normalizeTld("bad space")).toBeNull();
  });
});

describe("buildFqdn", () => {
  it("builds a normalized fqdn", () => {
    expect(buildFqdn("AgentCapability", "SI")).toEqual({
      sld: "agentcapability",
      tld: ".si",
      fqdn: "agentcapability.si",
    });
  });

  it("returns null when either part is invalid", () => {
    expect(buildFqdn("bad name", "com")).toBeNull();
    expect(buildFqdn("ok", "")).toBeNull();
  });
});

describe("parseDomain", () => {
  it("parses a full domain", () => {
    expect(parseDomain("AgentCapability.SI")).toEqual({
      sld: "agentcapability",
      tld: ".si",
      fqdn: "agentcapability.si",
    });
  });

  it("rejects inputs without a dot or with subdomains", () => {
    expect(parseDomain("agentcapability")).toBeNull();
    expect(parseDomain("sub.agentcapability.com")).toBeNull();
    expect(parseDomain("a.")).toBeNull();
  });
});
