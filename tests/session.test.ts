import { describe, expect, it } from "vitest";
import {
  SESSION_MAX_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  createSession,
  verifySession,
} from "@/lib/session";

const SECRET = "correct-horse-battery-staple";
const NOW = 1_700_000_000_000;

describe("createSession / verifySession", () => {
  it("round-trips a freshly created session", async () => {
    const { value, maxAge } = await createSession(SECRET, { now: NOW });
    expect(value.split(".")).toHaveLength(3);
    expect(value.startsWith("v1.")).toBe(true);
    expect(maxAge).toBe(SESSION_TTL_SECONDS);
    expect(await verifySession(value, SECRET, NOW)).toBe(true);
  });

  it("rejects a wrong secret", async () => {
    const { value } = await createSession(SECRET, { now: NOW });
    expect(await verifySession(value, "someone-elses-secret", NOW)).toBe(false);
  });

  it("fails closed with no secret", async () => {
    const { value } = await createSession(SECRET, { now: NOW });
    expect(await verifySession(value, undefined, NOW)).toBe(false);
    expect(await verifySession(value, "", NOW)).toBe(false);
  });

  it("rejects missing or malformed values", async () => {
    expect(await verifySession(null, SECRET, NOW)).toBe(false);
    expect(await verifySession(undefined, SECRET, NOW)).toBe(false);
    expect(await verifySession("", SECRET, NOW)).toBe(false);
    expect(await verifySession("v1.123", SECRET, NOW)).toBe(false);
    expect(await verifySession("v2.9999999999999.sig", SECRET, NOW)).toBe(false);
    expect(await verifySession("v1.not-a-number.sig", SECRET, NOW)).toBe(false);
  });

  it("accepts up to the expiry instant and rejects after it", async () => {
    const { value } = await createSession(SECRET, { now: NOW });
    const expiresAt = NOW + SESSION_TTL_SECONDS * 1000;
    expect(await verifySession(value, SECRET, expiresAt - 1)).toBe(true);
    expect(await verifySession(value, SECRET, expiresAt)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const { value } = await createSession(SECRET, { now: NOW });
    const [version, expires, signature] = value.split(".");
    const flipped =
      signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
    expect(await verifySession(`${version}.${expires}.${flipped}`, SECRET, NOW)).toBe(
      false,
    );
  });

  it("rejects a tampered expiry even when the format is valid", async () => {
    const { value } = await createSession(SECRET, { now: NOW });
    const [version, expires, signature] = value.split(".");
    const forged = `${version}.${Number(expires) + 1000 * 60 * 60 * 24 * 365}.${signature}`;
    expect(await verifySession(forged, SECRET, NOW)).toBe(false);
  });

  it("caps an over-long requested TTL", async () => {
    const { maxAge } = await createSession(SECRET, {
      now: NOW,
      ttlSeconds: SESSION_MAX_TTL_SECONDS * 10,
    });
    expect(maxAge).toBe(SESSION_MAX_TTL_SECONDS);
  });

  it("rejects an expiry beyond the hard cap", async () => {
    // Even a correctly-signed-looking value with an absurd expiry is rejected.
    expect(
      await verifySession(`v1.${NOW + 99_999_999_999}.anything`, SECRET, NOW),
    ).toBe(false);
  });
});
