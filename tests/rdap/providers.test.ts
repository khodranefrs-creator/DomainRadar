import { describe, it, expect } from "vitest";
import {
  sourceKeyForHost,
  knownSourceKeyForHost,
  sanitizeHostToKey,
  KNOWN_RDAP_HOSTS,
} from "@/lib/rdap/providers";
import { TLD_CATALOG } from "@/lib/tld-catalog";
import { SOURCE_CATALOG } from "@/lib/source-catalog";

describe("provider host -> source key", () => {
  it("maps known hosts to their registry source key", () => {
    expect(sourceKeyForHost("rdap.verisign.com")).toBe("rdap_verisign_com");
    expect(sourceKeyForHost("rdap.register.si")).toBe("rdap_register_si");
    expect(sourceKeyForHost("RDAP.IDENTITYDIGITAL.SERVICES")).toBe(
      "rdap_identity_digital",
    );
    expect(knownSourceKeyForHost("rdap.radix.host")).toBe("rdap_radix");
    expect(knownSourceKeyForHost("unknown.example.test")).toBeNull();
  });

  it("falls back to a deterministic sanitized key", () => {
    expect(sanitizeHostToKey("rdap.example.test")).toBe("rdap_rdap_example_test");
    expect(sourceKeyForHost("a-b.example")).toBe("rdap_a_b_example");
  });

  it("covers every verified catalog RDAP host", () => {
    const hosts = new Set(
      TLD_CATALOG.map((t) => t.rdapBaseUrl)
        .filter((u): u is string => Boolean(u))
        .map((u) => new URL(u).hostname),
    );
    for (const host of hosts) {
      expect(KNOWN_RDAP_HOSTS).toContain(host);
    }
  });

  it("maps every known provider host to an existing source catalog key", () => {
    const keys = new Set(SOURCE_CATALOG.map((s) => s.key));
    for (const host of KNOWN_RDAP_HOSTS) {
      expect(keys.has(sourceKeyForHost(host))).toBe(true);
    }
  });
});
