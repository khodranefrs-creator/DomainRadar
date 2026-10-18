// Pure mapping from transport/HTTP results to normalized statuses. No I/O, so
// every branch is unit-tested directly.
//
// Critical rule: HTTP 404 (or an empty body) means "no RDAP record", which is
// NOT a guarantee that a domain can be registered. It is mapped to NOT_FOUND,
// never to a synthetic "available" state.

import { AvailabilityStatus, ErrorKind } from "../enums";
import { SsrfError } from "../ssrf";

export interface MappedResponse {
  status: AvailabilityStatus;
  errorKind: ErrorKind | null;
  rawStatus: string | null;
  detail: string;
}

/** HTTP statuses worth retrying: rate limits, request timeout, server faults. */
export function isRetriableStatus(code: number): boolean {
  return code === 429 || code === 408 || (code >= 500 && code <= 599);
}

export function mapHttpResponse(
  status: number,
  bodyText: string | null,
): MappedResponse {
  if (status >= 300 && status < 400) {
    return {
      status: AvailabilityStatus.ERROR,
      errorKind: ErrorKind.REDIRECT,
      rawStatus: `HTTP ${status}`,
      detail: "Unexpected redirect from the RDAP provider.",
    };
  }

  if (status === 404) {
    return {
      status: AvailabilityStatus.NOT_FOUND,
      errorKind: null,
      rawStatus: "HTTP 404",
      detail:
        "No RDAP record returned. This does NOT mean the domain is available to register.",
    };
  }

  if (status === 429) {
    return {
      status: AvailabilityStatus.RATE_LIMITED,
      errorKind: ErrorKind.RATE_LIMITED,
      rawStatus: "HTTP 429",
      detail: "Provider rate limit reached; result is unknown until retried later.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: AvailabilityStatus.ERROR,
      errorKind: ErrorKind.AUTH,
      rawStatus: `HTTP ${status}`,
      detail: "Provider rejected the request (auth/forbidden).",
    };
  }

  if (status >= 400 && status < 500) {
    return {
      status: AvailabilityStatus.ERROR,
      errorKind: ErrorKind.CLIENT_ERROR,
      rawStatus: `HTTP ${status}`,
      detail: `Provider rejected the request (HTTP ${status}).`,
    };
  }

  if (status >= 500) {
    return {
      status: AvailabilityStatus.ERROR,
      errorKind: ErrorKind.SERVER_ERROR,
      rawStatus: `HTTP ${status}`,
      detail: `Provider server error (HTTP ${status}).`,
    };
  }

  if (status === 200) {
    return mapSuccessBody(bodyText);
  }

  return {
    status: AvailabilityStatus.UNKNOWN,
    errorKind: ErrorKind.UNKNOWN,
    rawStatus: `HTTP ${status}`,
    detail: `Unexpected response status ${status}.`,
  };
}

function mapSuccessBody(bodyText: string | null): MappedResponse {
  if (!bodyText || !bodyText.trim()) {
    return {
      status: AvailabilityStatus.ERROR,
      errorKind: ErrorKind.MALFORMED,
      rawStatus: "HTTP 200 (empty body)",
      detail: "Provider returned 200 with an empty body; result not trustworthy.",
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    return {
      status: AvailabilityStatus.ERROR,
      errorKind: ErrorKind.MALFORMED,
      rawStatus: "HTTP 200 (unparseable body)",
      detail: "Provider returned 200 with a non-JSON body.",
    };
  }
  const obj = json as Record<string, unknown> | null;
  const objectClassName =
    obj && typeof obj.objectClassName === "string" ? obj.objectClassName : null;
  const ldhName = obj && typeof obj.ldhName === "string" ? obj.ldhName : null;

  if (objectClassName === "domain" || ldhName) {
    const statuses = Array.isArray(obj?.status)
      ? (obj!.status as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    return {
      status: AvailabilityStatus.REGISTERED,
      errorKind: null,
      rawStatus: statuses.length ? statuses.join(", ") : "domain record",
      detail: "RDAP domain record present (registered).",
    };
  }

  return {
    status: AvailabilityStatus.UNKNOWN,
    errorKind: ErrorKind.MALFORMED,
    rawStatus: "HTTP 200 (non-domain object)",
    detail: "200 response was not an RDAP domain object; result inconclusive.",
  };
}

export function classifyTransportError(error: unknown): {
  errorKind: ErrorKind;
  detail: string;
} {
  if (error instanceof SsrfError) {
    return { errorKind: ErrorKind.SSRF_BLOCKED, detail: error.message };
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return { errorKind: ErrorKind.TIMEOUT, detail: "Request was aborted." };
    }
    const message = error.message || error.name;
    if (/timed?\s*out/i.test(message)) {
      return { errorKind: ErrorKind.TIMEOUT, detail: message };
    }
    return { errorKind: ErrorKind.NETWORK, detail: message };
  }
  return { errorKind: ErrorKind.UNKNOWN, detail: String(error) };
}
