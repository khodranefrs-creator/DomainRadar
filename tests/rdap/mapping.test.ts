import { describe, it, expect } from "vitest";
import {
  mapHttpResponse,
  isRetriableStatus,
  classifyTransportError,
} from "@/lib/rdap/mapping";
import { AvailabilityStatus, ErrorKind } from "@/lib/enums";
import { SsrfError } from "@/lib/ssrf";

describe("mapHttpResponse", () => {
  it("maps a 200 RDAP domain object to REGISTERED and keeps registry statuses", () => {
    const body = JSON.stringify({
      objectClassName: "domain",
      ldhName: "GOOGLE.COM",
      status: ["client transfer prohibited", "server delete prohibited"],
    });
    const mapped = mapHttpResponse(200, body);
    expect(mapped.status).toBe(AvailabilityStatus.REGISTERED);
    expect(mapped.errorKind).toBeNull();
    expect(mapped.rawStatus).toContain("server delete prohibited");
  });

  it("maps 200 with ldhName only to REGISTERED", () => {
    const mapped = mapHttpResponse(200, JSON.stringify({ ldhName: "x.si" }));
    expect(mapped.status).toBe(AvailabilityStatus.REGISTERED);
  });

  it("maps 404 to NOT_FOUND, never an availability guarantee", () => {
    const mapped = mapHttpResponse(404, null);
    expect(mapped.status).toBe(AvailabilityStatus.NOT_FOUND);
    expect(mapped.detail.toLowerCase()).toContain("not");
    expect(mapped.status).not.toBe("AVAILABLE");
  });

  it("maps 429 to RATE_LIMITED", () => {
    const mapped = mapHttpResponse(429, null);
    expect(mapped.status).toBe(AvailabilityStatus.RATE_LIMITED);
    expect(mapped.errorKind).toBe(ErrorKind.RATE_LIMITED);
  });

  it("maps auth and client errors", () => {
    expect(mapHttpResponse(401, null).errorKind).toBe(ErrorKind.AUTH);
    expect(mapHttpResponse(403, null).errorKind).toBe(ErrorKind.AUTH);
    expect(mapHttpResponse(400, null).errorKind).toBe(ErrorKind.CLIENT_ERROR);
    expect(mapHttpResponse(422, null).errorKind).toBe(ErrorKind.CLIENT_ERROR);
  });

  it("maps 5xx to SERVER_ERROR", () => {
    const mapped = mapHttpResponse(503, null);
    expect(mapped.status).toBe(AvailabilityStatus.ERROR);
    expect(mapped.errorKind).toBe(ErrorKind.SERVER_ERROR);
  });

  it("maps 3xx redirects to ERROR/REDIRECT", () => {
    const mapped = mapHttpResponse(302, null);
    expect(mapped.errorKind).toBe(ErrorKind.REDIRECT);
  });

  it("treats an empty or non-JSON 200 body as MALFORMED, not registered", () => {
    expect(mapHttpResponse(200, "").errorKind).toBe(ErrorKind.MALFORMED);
    expect(mapHttpResponse(200, "not json").errorKind).toBe(ErrorKind.MALFORMED);
  });

  it("treats a 200 non-domain object as inconclusive UNKNOWN", () => {
    const mapped = mapHttpResponse(200, JSON.stringify({ objectClassName: "entity" }));
    expect(mapped.status).toBe(AvailabilityStatus.UNKNOWN);
    expect(mapped.errorKind).toBe(ErrorKind.MALFORMED);
  });
});

describe("isRetriableStatus", () => {
  it("retries rate limits, request timeout and server errors only", () => {
    expect(isRetriableStatus(429)).toBe(true);
    expect(isRetriableStatus(408)).toBe(true);
    expect(isRetriableStatus(500)).toBe(true);
    expect(isRetriableStatus(503)).toBe(true);
    expect(isRetriableStatus(404)).toBe(false);
    expect(isRetriableStatus(400)).toBe(false);
    expect(isRetriableStatus(200)).toBe(false);
  });
});

describe("classifyTransportError", () => {
  it("classifies SSRF, abort/timeout and network errors", () => {
    expect(classifyTransportError(new SsrfError("nope")).errorKind).toBe(
      ErrorKind.SSRF_BLOCKED,
    );
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(classifyTransportError(abort).errorKind).toBe(ErrorKind.TIMEOUT);
    expect(classifyTransportError(new Error("timed out")).errorKind).toBe(
      ErrorKind.TIMEOUT,
    );
    expect(classifyTransportError(new TypeError("fetch failed")).errorKind).toBe(
      ErrorKind.NETWORK,
    );
  });
});
