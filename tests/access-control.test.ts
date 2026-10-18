import { describe, it, expect } from "vitest";
import {
  BASIC_CHALLENGE,
  decideAccess,
  getAccessMode,
  getUsername,
  hostnameFromHeader,
  isAuthExemptPath,
  parseBasicAuth,
  timingSafeEqualStrings,
} from "@/lib/access-control";

const TOKEN = "correct-horse-battery-staple";
const USER = "domain-radar";

function basic(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function local(
  hostHeader: string | null,
  authorizationHeader: string | null = null,
) {
  return decideAccess({
    mode: "local",
    hostHeader,
    authorizationHeader,
    token: TOKEN,
    username: USER,
  });
}

function deployment(input: {
  hostHeader?: string | null;
  authorizationHeader?: string | null;
  token?: string | undefined;
  username?: string;
}) {
  return decideAccess({
    mode: "deployment",
    hostHeader: input.hostHeader ?? "domain-radar.vercel.app",
    authorizationHeader: input.authorizationHeader ?? null,
    token: "token" in input ? input.token : TOKEN,
    username: input.username ?? USER,
  });
}

describe("getAccessMode", () => {
  it("defaults to local when unset or blank", () => {
    expect(getAccessMode({})).toBe("local");
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "" })).toBe("local");
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "  " })).toBe("local");
  });

  it("only enables deployment for the explicit value", () => {
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "deployment" })).toBe(
      "deployment",
    );
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "DEPLOYMENT" })).toBe(
      "deployment",
    );
  });

  it("treats unknown values as local (fail safe)", () => {
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "public" })).toBe("local");
    expect(getAccessMode({ DOMAIN_RADAR_ACCESS_MODE: "true" })).toBe("local");
  });
});

describe("getUsername", () => {
  it("falls back to the default username", () => {
    expect(getUsername({})).toBe("domain-radar");
    expect(getUsername({ DOMAIN_RADAR_ACCESS_USER: "   " })).toBe(
      "domain-radar",
    );
  });

  it("honours an explicit username", () => {
    expect(getUsername({ DOMAIN_RADAR_ACCESS_USER: "alice" })).toBe("alice");
  });
});

describe("timingSafeEqualStrings", () => {
  it("matches equal strings and rejects different ones", () => {
    expect(timingSafeEqualStrings("abc", "abc")).toBe(true);
    expect(timingSafeEqualStrings("abc", "abd")).toBe(false);
    expect(timingSafeEqualStrings("abc", "ab")).toBe(false);
    expect(timingSafeEqualStrings("", "")).toBe(true);
    expect(timingSafeEqualStrings("", "x")).toBe(false);
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

describe("parseBasicAuth", () => {
  it("decodes a valid Basic header", () => {
    expect(parseBasicAuth(basic("user", "pass"))).toEqual({
      username: "user",
      password: "pass",
    });
  });

  it("preserves colons inside the password", () => {
    expect(parseBasicAuth(basic("u", "a:b:c"))).toEqual({
      username: "u",
      password: "a:b:c",
    });
  });

  it("rejects missing or malformed headers", () => {
    expect(parseBasicAuth(null)).toBeNull();
    expect(parseBasicAuth("")).toBeNull();
    expect(parseBasicAuth("Bearer abc")).toBeNull();
    expect(parseBasicAuth("Basic")).toBeNull();
    expect(parseBasicAuth("Basic !!!not-base64!!!")).toBeNull();
    expect(parseBasicAuth(`Basic ${btoa("no-colon-here")}`)).toBeNull();
  });
});

describe("decideAccess — local mode", () => {
  it("allows loopback hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "::1", "[::1]"]) {
      expect(local(host)).toEqual({ ok: true });
    }
    // A port is valid after a name or a bracketed IPv6 literal (not after a
    // bare unbracketed IPv6 address).
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      expect(local(`${host}:3000`)).toEqual({ ok: true });
    }
  });

  it("blocks non-loopback hosts", () => {
    const decision = local("domain-radar.vercel.app");
    expect(decision).toMatchObject({ ok: false, status: 403 });
  });

  it("blocks when the Host header is missing", () => {
    expect(local(null)).toMatchObject({ ok: false, status: 403 });
  });

  it("stays closed even when a valid token is supplied", () => {
    // The local guard is not bypassed by presentation of credentials.
    expect(local("evil.example.com", basic(USER, TOKEN))).toMatchObject({
      ok: false,
      status: 403,
    });
  });
});

describe("decideAccess — deployment mode", () => {
  it("fails closed when no token is configured", () => {
    const decision = deployment({
      token: undefined,
      authorizationHeader: basic(USER, "whatever"),
    });
    expect(decision).toMatchObject({ ok: false, status: 503 });

    const blank = deployment({ token: "" });
    expect(blank).toMatchObject({ ok: false, status: 503 });
  });

  it("challenges requests without credentials", () => {
    const decision = deployment({ authorizationHeader: null });
    expect(decision).toMatchObject({ ok: false, status: 401 });
    if (!decision.ok) {
      expect(decision.challenge).toBe(BASIC_CHALLENGE);
    }
  });

  it("rejects a wrong password", () => {
    const decision = deployment({
      authorizationHeader: basic(USER, "wrong-token"),
    });
    expect(decision).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects a wrong username", () => {
    const decision = deployment({
      authorizationHeader: basic("someone-else", TOKEN),
    });
    expect(decision).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects a malformed authorization header", () => {
    expect(
      deployment({ authorizationHeader: "Basic !!!not-base64!!!" }),
    ).toMatchObject({ ok: false, status: 401 });
  });

  it("allows the correct credentials", () => {
    const decision = deployment({
      authorizationHeader: basic(USER, TOKEN),
    });
    expect(decision).toEqual({ ok: true });
  });

  it("does not use the Host header as the boundary", () => {
    // A spoofed/foreign Host with valid credentials is allowed: the token, not
    // the Host header, is the security boundary in deployment mode.
    expect(
      deployment({
        hostHeader: "spoofed.example.com",
        authorizationHeader: basic(USER, TOKEN),
      }),
    ).toEqual({ ok: true });
  });

  it("accepts a custom configured username", () => {
    const decision = deployment({
      username: "owner",
      authorizationHeader: basic("owner", TOKEN),
    });
    expect(decision).toEqual({ ok: true });
  });
});

describe("isAuthExemptPath", () => {
  it("exempts the login page, auth endpoints and Next assets", () => {
    expect(isAuthExemptPath("/login")).toBe(true);
    expect(isAuthExemptPath("/api/auth/login")).toBe(true);
    expect(isAuthExemptPath("/api/auth/logout")).toBe(true);
    expect(isAuthExemptPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isAuthExemptPath("/favicon.ico")).toBe(true);
  });

  it("does not exempt app pages or protected APIs", () => {
    for (const path of [
      "/",
      "/sources",
      "/candidates",
      "/api/candidates",
      "/api/candidates/export",
      "/api/search",
      "/api/sources",
      "/api/tlds",
      "/api/settings",
    ]) {
      expect(isAuthExemptPath(path)).toBe(false);
    }
  });
});

describe("decideAccess — deployment mode with sessions", () => {
  function assess(extra: {
    pathname?: string;
    sessionValid?: boolean;
    token?: string | undefined;
  }) {
    return decideAccess({
      mode: "deployment",
      hostHeader: "domain-radar.vercel.app",
      authorizationHeader: null,
      token: TOKEN,
      username: USER,
      ...extra,
    });
  }

  it("allows the login page and auth endpoints without a session", () => {
    expect(assess({ pathname: "/login" })).toEqual({ ok: true });
    expect(assess({ pathname: "/api/auth/login" })).toEqual({ ok: true });
    expect(assess({ pathname: "/api/auth/logout" })).toEqual({ ok: true });
  });

  it("allows pages and APIs when the session cookie is valid", () => {
    expect(assess({ pathname: "/", sessionValid: true })).toEqual({ ok: true });
    expect(assess({ pathname: "/sources", sessionValid: true })).toEqual({
      ok: true,
    });
    expect(
      assess({ pathname: "/api/candidates", sessionValid: true }),
    ).toEqual({ ok: true });
  });

  it("still challenges protected paths without a session", () => {
    expect(
      assess({ pathname: "/api/candidates", sessionValid: false }),
    ).toMatchObject({ ok: false, status: 401 });
    expect(assess({ pathname: "/", sessionValid: false })).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("fails closed on protected paths when no token is configured, but keeps login reachable", () => {
    expect(assess({ token: undefined, pathname: "/api/candidates" })).toMatchObject(
      { ok: false, status: 503 },
    );
    expect(assess({ token: undefined, pathname: "/" })).toMatchObject({
      ok: false,
      status: 503,
    });
    expect(assess({ token: undefined, pathname: "/login" })).toEqual({ ok: true });
  });

  it("ignores sessionValid in local mode (loopback guard still wins)", () => {
    const decision = decideAccess({
      mode: "local",
      hostHeader: "evil.example.com",
      authorizationHeader: null,
      token: TOKEN,
      username: USER,
      sessionValid: true,
      pathname: "/login",
    });
    expect(decision).toMatchObject({ ok: false, status: 403 });
  });
});
