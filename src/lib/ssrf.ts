// SSRF guard: outbound fetches are restricted to approved provider hosts.
// Any adapter performing a network request MUST go through assertAllowedUrl.

import { TLD_CATALOG } from "./tld-catalog";

const APPROVED_HOSTS = new Set<string>([
  "rdap.register.si",
  "rdap.verisign.com",
  "rdap.identitydigital.services",
  "pubapi.registry.google",
  "rdap.publicinterestregistry.org",
  "rdap.radix.host",
  "rdap.centralnic.com",
  "rdap.registry.cloud",
  "data.iana.org",
  "api.namebio.com",
]);

// Known TLD RDAP hosts are derived from the verified catalog so the list stays
// in sync with what we actually support.
for (const t of TLD_CATALOG) {
  if (t.rdapBaseUrl) {
    try {
      APPROVED_HOSTS.add(new URL(t.rdapBaseUrl).hostname);
    } catch {
      // ignore malformed catalog entries (none expected)
    }
  }
}

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

const BLOCKED_PROTOCOLS = new Set(["file:", "ftp:", "gopher:", "data:", "blob:"]);

/**
 * Assert a URL is safe to fetch: https only, no credentials, no private/
 * loopback/link-local host, and host must be on the approved allowlist.
 */
export function assertAllowedUrl(raw: string, allowlist?: Set<string>): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError(`Invalid URL: ${raw}`);
  }

  if (BLOCKED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfError(`Blocked protocol: ${url.protocol}`);
  }
  if (url.protocol !== "https:") {
    throw new SsrfError(`Only https is allowed, got: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new SsrfError("URLs with embedded credentials are not allowed");
  }

  const host = url.hostname.toLowerCase();
  if (isPrivateHost(host)) {
    throw new SsrfError(`Blocked private/internal host: ${host}`);
  }

  const approved = allowlist ?? APPROVED_HOSTS;
  if (!approved.has(host)) {
    throw new SsrfError(`Host not on approved allowlist: ${host}`);
  }

  return url;
}

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "[::1]" || host === "::1") return true;
  // IPv4 loopback / private / link-local
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127) return true; // loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 169 && b === 254) return true; // link-local
    if (a === 0) return true;
  }
  // IPv6 loopback / unique local / link local (loose check)
  if (host.startsWith("[fe80:") || host.startsWith("[fc") || host.startsWith("[fd")) {
    return true;
  }
  return false;
}

export function getApprovedHosts(): string[] {
  return Array.from(APPROVED_HOSTS).sort();
}
