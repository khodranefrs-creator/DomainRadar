// Access control for Domain Radar.
//
// The app is local-first. By default — and whenever the mode is unset or
// unrecognised — the proxy only answers requests whose Host header is loopback
// and refuses everything else. That remains the safe default for development.
//
// An explicit, opt-in "public" mode exists for the hosted deployment, which is
// intentionally open: every request is served without authentication. The
// loopback allowlist is not used as a boundary in public mode, so the Host
// header never grants or denies access there.
//
// This module is deliberately free of Next.js imports so the decision logic can
// be unit tested in isolation.

export type AccessMode = "local" | "public";

export const LOCAL_ALLOWED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export function getAccessMode(
  env: Record<string, string | undefined>,
): AccessMode {
  // Anything other than an explicit "public" keeps the restrictive local guard,
  // so a typo can never accidentally expose the app.
  return (env.DOMAIN_RADAR_ACCESS_MODE ?? "").trim().toLowerCase() === "public"
    ? "public"
    : "local";
}

export type AccessDecision =
  | { ok: true }
  | { ok: false; status: number; message: string };

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
}): AccessDecision {
  // Public mode is intentionally open. It is opt-in and only reachable when
  // DOMAIN_RADAR_ACCESS_MODE is explicitly "public".
  if (input.mode === "public") return { ok: true };

  const hostname = hostnameFromHeader(input.hostHeader);
  if (LOCAL_ALLOWED_HOSTS.has(hostname)) return { ok: true };
  return {
    ok: false,
    status: 403,
    message: "Forbidden: Domain Radar is local-only.",
  };
}
