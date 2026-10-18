import { describe, expect, it } from "vitest";
import {
  decideAccess,
  getAccessMode,
  hostnameFromHeader,
  LOCAL_ALLOWED_HOSTS,
} from "@/lib/access-control";

describe("getAccessMode", () => {
  it("defaults to local when unset or blank", () => {
    expect(getAccessMode({})).toBe("local");
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "" })).toBe("local");
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "  " })).toBe("local");
  });

  it("only enables public for the explicit value", () => {
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "public" })).toBe("public");
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "PUBLIC" })).toBe("public");
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: " public " })).toBe(
      "public",
    );
  });

  it("treats unknown values as local (fail safe)", () => {
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "true" })).toBe("local");
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "deployment" })).toBe(
      "local",
    );
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "yes" })).toBe("local");
  });
});

describe("hostnameFromHeader", () => {
  it("strips ports and lowercases", () => {
    expect(hostnameFromHeader("localhost:3000")).toBe("localhost");
    expect(hostnameFromHeader("127.0.0.1:8080")).toBe("127.0.0.1");
    expect(hostnameFromHeader("Example.COM")).toBe("example.com");
  });

  it("handles bracketed IPv6 literals", () => {
    expect(hostnameFromHeader("[::1]:3000")).toBe("[::1]");
    expect(hostnameFromHeader("[::1]")).toBe("[::1]");
  });

  it("returns an empty string for a missing header", () => {
    expect(hostnameFromHeader(null)).toBe("");
    expect(hostnameFromHeader("")).toBe("");
  });
});

describe("decideAccess — local mode", () => {
  it("allows loopback hosts", () => {
    for (const host of LOCAL_ALLOWED_HOSTS) {
      expect(decideAccess({ mode: "local", hostHeader: host })).toEqual({
        ok: true,
      });
    }
  });

  it("blocks non-loopback hosts", () => {
    expect(
      decideAccess({ mode: "local", hostHeader: "domain-radar.vercel.app" }),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("blocks when the Host header is missing", () => {
    expect(decideAccess({ mode: "local", hostHeader: null })).toMatchObject({
      ok: false,
      status: 403,
    });
  });
});

describe("decideAccess — public mode", () => {
  it("serves any host without authentication", () => {
    for (const host of [
      "domain-radar.vercel.app",
      "spoofed.example.com",
      null,
      "localhost:3000",
    ]) {
      expect(decideAccess({ mode: "public", hostHeader: host })).toEqual({
        ok: true,
      });
    }
  });
});
