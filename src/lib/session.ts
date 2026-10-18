// Signed session cookie for the protected "deployment" access mode.
//
// The cookie is a compact, tamper-evident token: `v1.<expiresAtMs>.<hmac>`.
// The HMAC-SHA256 key is the existing DOMAIN_RADAR_ACCESS_TOKEN, so no new
// secret is introduced and disabling the token disables sessions too. The value
// carries no user data — it only proves "this browser presented the token
// before its expiry" — so it is safe to store in an HttpOnly cookie.
//
// Deliberately free of Next.js imports so it can be unit tested in isolation.

import { timingSafeEqualStrings } from "@/lib/access-control";

export const SESSION_COOKIE = "dr_session";
export const SESSION_VERSION = "v1";

// How long a login lasts (sliding-free, absolute). Long enough to avoid
// re-entering the password for a personal tool, short enough to expire.
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
// Hard cap: never accept a cookie claiming to live longer than this.
export const SESSION_MAX_TTL_SECONDS = 60 * 60 * 24 * 120; // 120 days

const encoder = new TextEncoder();

export interface SessionCookie {
  value: string;
  maxAge: number;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return base64Url(new Uint8Array(signature));
}

export async function createSession(
  secret: string,
  options: { now?: number; ttlSeconds?: number } = {},
): Promise<SessionCookie> {
  const now = options.now ?? Date.now();
  const requested = options.ttlSeconds ?? SESSION_TTL_SECONDS;
  const ttl = Math.min(Math.max(requested, 60), SESSION_MAX_TTL_SECONDS);
  const payload = `${SESSION_VERSION}.${now + ttl * 1000}`;
  const signature = await sign(payload, secret);
  return { value: `${payload}.${signature}`, maxAge: ttl };
}

export async function verifySession(
  value: string | null | undefined,
  secret: string | undefined,
  now: number = Date.now(),
): Promise<boolean> {
  if (!value || !secret) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [version, expiresRaw, signature] = parts;
  if (version !== SESSION_VERSION) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt)) return false;
  if (expiresAt <= now) return false;
  if (expiresAt > now + SESSION_MAX_TTL_SECONDS * 1000) return false;

  const expected = await sign(`${version}.${expiresRaw}`, secret);
  return timingSafeEqualStrings(signature, expected);
}
