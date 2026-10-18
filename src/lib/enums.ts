// Canonical enum-like values. SQLite + Prisma stores these as strings; Zod and
// these constants keep them consistent until a move to native DB enums (PG).

export const TldStatus = {
  AVAILABLE: "AVAILABLE",
  UNSUPPORTED: "UNSUPPORTED",
  NEEDS_VERIFICATION: "NEEDS_VERIFICATION",
  DISABLED: "DISABLED",
} as const;
export type TldStatus = (typeof TldStatus)[keyof typeof TldStatus];

export const SourceStatus = {
  AVAILABLE: "AVAILABLE",
  MANUAL_ONLY: "MANUAL_ONLY",
  DISABLED: "DISABLED",
  RATE_LIMITED: "RATE_LIMITED",
  NEEDS_CONFIGURATION: "NEEDS_CONFIGURATION",
} as const;
export type SourceStatus = (typeof SourceStatus)[keyof typeof SourceStatus];

export const SourceKind = {
  RDAP: "RDAP",
  API: "API",
  RSS: "RSS",
  MANUAL: "MANUAL",
  DATASET: "DATASET",
  PORTAL: "PORTAL",
} as const;
export type SourceKind = (typeof SourceKind)[keyof typeof SourceKind];

// A 404 or missing record is NOT a guarantee of registrability.
export const AvailabilityStatus = {
  REGISTERED: "REGISTERED",
  NOT_FOUND: "NOT_FOUND", // returned by provider; registrability NOT guaranteed
  RESERVED: "RESERVED",
  RESTRICTED: "RESTRICTED",
  RATE_LIMITED: "RATE_LIMITED",
  UNKNOWN: "UNKNOWN", // insufficient evidence — never shown as available
  UNSUPPORTED: "UNSUPPORTED",
  ERROR: "ERROR",
} as const;
export type AvailabilityStatus =
  (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

export const ErrorKind = {
  TIMEOUT: "TIMEOUT",
  NETWORK: "NETWORK",
  RATE_LIMITED: "RATE_LIMITED",
  SERVER_ERROR: "SERVER_ERROR",
  CLIENT_ERROR: "CLIENT_ERROR",
  AUTH: "AUTH",
  REDIRECT: "REDIRECT",
  MALFORMED: "MALFORMED",
  UNSUPPORTED: "UNSUPPORTED",
  SSRF_BLOCKED: "SSRF_BLOCKED",
  UNKNOWN: "UNKNOWN",
} as const;
export type ErrorKind = (typeof ErrorKind)[keyof typeof ErrorKind];

export const SessionStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const CandidateStatus = {
  CANDIDATE: "CANDIDATE",
  SHORTLISTED: "SHORTLISTED",
  REJECTED: "REJECTED",
  ARCHIVED: "ARCHIVED",
} as const;
export type CandidateStatus =
  (typeof CandidateStatus)[keyof typeof CandidateStatus];

export const EvidenceType = {
  DIRECT_OBSERVATION: "DIRECT_OBSERVATION",
  THIRD_PARTY_REPORT: "THIRD_PARTY_REPORT",
  ESTIMATE: "ESTIMATE",
  USER_NOTE: "USER_NOTE",
} as const;
export type EvidenceType = (typeof EvidenceType)[keyof typeof EvidenceType];

export const Reliability = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  UNKNOWN: "UNKNOWN",
} as const;
export type Reliability = (typeof Reliability)[keyof typeof Reliability];

export const VerificationStatus = {
  VERIFIED: "VERIFIED",
  REPORTED: "REPORTED",
  UNVERIFIED: "UNVERIFIED",
} as const;
export type VerificationStatus =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const RiskLevel = {
  UNKNOWN: "UNKNOWN",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const TrademarkStatus = {
  NOT_REVIEWED: "NOT_REVIEWED",
  NO_MATCH_FOUND: "NO_MATCH_FOUND",
  MATCH_FOUND: "MATCH_FOUND",
  POSSIBLE_MATCH: "POSSIBLE_MATCH",
} as const;
export type TrademarkStatus =
  (typeof TrademarkStatus)[keyof typeof TrademarkStatus];

export const TrademarkGate = {
  UNKNOWN: "UNKNOWN",
  PASS: "PASS",
  BLOCK: "BLOCK",
} as const;
export type TrademarkGate = (typeof TrademarkGate)[keyof typeof TrademarkGate];

export const Decision = {
  BUY: "BUY",
  REVIEW: "REVIEW",
  PASS: "PASS",
  KILL: "KILL",
} as const;
export type Decision = (typeof Decision)[keyof typeof Decision];

export const HoldingStatus = {
  WATCHING: "WATCHING",
  HELD: "HELD",
  LISTED: "LISTED",
  SOLD: "SOLD",
  DROPPED: "DROPPED",
} as const;
export type HoldingStatus = (typeof HoldingStatus)[keyof typeof HoldingStatus];

export const ObservationKind = {
  AVAILABILITY: "AVAILABILITY",
  WEBSITE_PRESENCE: "WEBSITE_PRESENCE",
  LISTING: "LISTING",
  MARKET_STAT: "MARKET_STAT",
  NEWS: "NEWS",
} as const;
export type ObservationKind =
  (typeof ObservationKind)[keyof typeof ObservationKind];
