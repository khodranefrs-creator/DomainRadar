// Access control for Domain Radar.
//
// The app is local-first. By default the proxy only answers requests whose Host
// header is loopback, and refuses everything else. That is the safe default and
// it stays untouched.
//
// An explicit, opt-in "deployment" mode exists for personal remote use (for
// example, behind Vercel). Deployment mode never trusts the Host header as a
// security boundary — Host is trivial to spoof — so it does not use the
// loopback allowlist to grant access. Instead every request must authenticate
// with a shared token over HTTP Basic auth, and the mode fails closed when no
// token is configured.
//
// This module is deliberately free of Next.js imports so the decision logic can
// be unit tested in isolation.

export type AccessMode = "local" | "deployment";

export const LOCAL_ALLOWED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export const DEFAULT_ACCESS_USER = "domain-radar";

export const BASIC_CHALLENGE = 'Basic realm="Domain Radar", charset="UTF-8"';

// Paths a browser must reach WITHOUT a session so it can log in: the login page,
// the login/logout endpoints, and Next's own static assets (the login page's
// JS/CSS load before any cookie exists). None of these expose application data
// or a protected /api route.
const AUTH_EXEMPT_EXACT = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/favicon.ico",
]);

export function isAuthExemptPath(pathname: string): boolean {
  if (!pathname) return false;
  if (AUTH_EXEMPT_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  return false;
}

export type AccessDecision =
  | { ok: true }
  | { ok: false; status: number; message: string; challenge?: string };

export function getAccessMode(
  env: Record<string, string | undefined>,
): AccessMode {
  // Anything other than an explicit "deployment" keeps the restrictive local
  // guard, so a typo can never accidentally expose the app.
  return (env.DOMAIN_RADAR_ACCESS_MODE ?? "").trim().toLowerCase() ===
    "deployment"
    ? "deployment"
    : "local";
}

export function getUsername(
  env: Record<string, string | undefined>,
): string {
  const value = (env.DOMAIN_RADAR_ACCESS_USER ?? "").trim();
  return value.length > 0 ? value : DEFAULT_ACCESS_USER;
}

// Constant-time string comparison (no early exit on first mismatch) so token
// checks do not leak information through response timing.
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

// Extract a "user:pass" pair from an HTTP Basic Authorization header. Returns
// null for a missing, malformed, or non-Basic header.
export function parseBasicAuth(
  header: string | null,
): { username: string; password: string } | null {
  if (!header) return null;
  const match = /^Basic\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;

  let decoded: string;
  try {
    decoded = atob(match[1]);
  } catch {
    return null;
  }

  const separator = decoded.indexOf(":");
  if (separator === -1) return null;
  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

// Extracts the hostname from a Host header, tolerating a bracketed IPv6 literal
// with an optional port (e.g. "[::1]:3000" -> "[::1]") and a name with a port
// (e.g. "localhost:3000" -> "localhost").
export function hostnameFromHeader(hostHeader: string | null): string {
  if (!hostHeader) return "";
  const header = hostHeader.trim();
  if (header.startsWith("[")) {
    const end = header.indexOf("]");
    return (end === -1 ? header : header.slice(0, end + 1)).toLowerCase();
  }
  // A bare IPv6 literal (two or more colons, e.g. "::1") has no port syntax;
  // a port is only unambiguous after a bracketed literal or a hostname.
  if ((header.match(/:/g)?.length ?? 0) >= 2) {
    return header.toLowerCase();
  }
  return header.split(":")[0].toLowerCase();
}

export function decideAccess(input: {
  mode: AccessMode;
  hostHeader: string | null;
  authorizationHeader: string | null;
  token: string | undefined;
  username: string;
  // Deployment mode only: a request may be admitted by a valid session cookie
  // (verified by the caller, which owns the async crypto) or by the exempt
  // login/auth/static paths. Both default to off, so callers that omit them get
  // the original token-only behaviour.
  sessionValid?: boolean;
  pathname?: string;
}): AccessDecision {
  if (input.mode === "local") {
    const hostname = hostnameFromHeader(input.hostHeader);
    if (LOCAL_ALLOWED_HOSTS.has(hostname)) return { ok: true };
    return {
      ok: false,
      status: 403,
      message: "Forbidden: Domain Radar is local-only.",
    };
  }

  // Deployment mode: the login page and its assets must load before a cookie
  // exists, and a verified session cookie is accepted as proof of login.
  if (isAuthExemptPath(input.pathname ?? "")) return { ok: true };
  if (input.sessionValid) return { ok: true };

  // A missing secret must never open the app to the world, so refuse every
  // non-exempt request rather than serving it unauthenticated.
  const token = input.token ?? "";
  if (token.length === 0) {
    return {
      ok: false,
      status: 503,
      message:
        "Domain Radar is misconfigured: deployment mode requires DOMAIN_RADAR_ACCESS_TOKEN. Refusing all requests.",
    };
  }

  const credentials = parseBasicAuth(input.authorizationHeader);
  if (!credentials) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized",
      challenge: BASIC_CHALLENGE,
    };
  }

  const usernameOk = timingSafeEqualStrings(
    credentials.username,
    input.username,
  );
  const passwordOk = timingSafeEqualStrings(credentials.password, token);
  if (!usernameOk || !passwordOk) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized",
      challenge: BASIC_CHALLENGE,
    };
  }

  return { ok: true };
}
