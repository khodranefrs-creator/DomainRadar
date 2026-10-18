import { describe, it, expect } from "vitest";
import { assertAllowedUrl, SsrfError, getApprovedHosts } from "@/lib/ssrf";

describe("assertAllowedUrl", () => {
  it("allows approved provider hosts over https", () => {
    expect(
      assertAllowedUrl("https://rdap.register.si/domain/arnes.si").hostname,
    ).toBe("rdap.register.si");
    expect(
      assertAllowedUrl("https://api.namebio.com/retailstats").hostname,
    ).toBe("api.namebio.com");
  });

  it("rejects non-https protocols", () => {
    expect(() => assertAllowedUrl("http://rdap.register.si/x")).toThrow(SsrfError);
    expect(() => assertAllowedUrl("file:///etc/passwd")).toThrow(SsrfError);
    expect(() => assertAllowedUrl("ftp://example.com/x")).toThrow(SsrfError);
  });

  it("rejects loopback and private hosts", () => {
    expect(() => assertAllowedUrl("https://localhost/x")).toThrow(SsrfError);
    expect(() => assertAllowedUrl("https://127.0.0.1/x")).toThrow(SsrfError);
    expect(() => assertAllowedUrl("https://10.0.0.5/x")).toThrow(SsrfError);
    expect(() => assertAllowedUrl("https://192.168.1.1/x")).toThrow(SsrfError);
    expect(() => assertAllowedUrl("https://169.254.169.254/latest/meta-data")).toThrow(
      SsrfError,
    );
  });

  it("rejects hosts not on the allowlist", () => {
    expect(() => assertAllowedUrl("https://evil.example.com/x")).toThrow(SsrfError);
    expect(() => assertAllowedUrl("https://rdap.register.si.evil.com/x")).toThrow(
      SsrfError,
    );
  });

  it("rejects embedded credentials", () => {
    expect(() => assertAllowedUrl("https://user:pass@rdap.register.si/x")).toThrow(
      SsrfError,
    );
  });

  it("rejects malformed URLs", () => {
    expect(() => assertAllowedUrl("not a url")).toThrow(SsrfError);
  });

  it("exposes the approved host list", () => {
    const hosts = getApprovedHosts();
    expect(hosts).toContain("rdap.register.si");
    expect(hosts).toContain("api.namebio.com");
  });
});
