// Pure planning logic for bulk research jobs: turning free-form paste text or a
// CSV into a deduped, validated list of (label, TLD) work items. No I/O — unit
// tested in tests/jobs/spec.test.ts.
//
// Design notes
// - A "label" is the SLD (second-level label). Users may paste bare labels
//   ("acme"), fully-qualified domains ("acme.com"), or CSV with a domain column.
// - When a user pastes full domains we honour the domains' own TLDs and ignore
//   the requested-TLD matrix for those rows (their TLD is explicit). Bare labels
//   are expanded across the requested TLDs.
// - Everything is deduped by fqdn; the first occurrence wins and later
//   duplicates are reported as rejected so the user gets an honest count.

import { parseDomain, isValidLabel, normalizeTld } from "../domain";
import { parseCsv, CsvError } from "../csv";

export interface PlannedItem {
  sld: string;
  tld: string;
}

export interface RejectedLine {
  /** 1-based line number in the original input (best effort). */
  line: number;
  value: string;
  reason: string;
}

export interface PlanResult {
  items: PlannedItem[];
  rejected: RejectedLine[];
  /** Items dropped because they exceeded the per-job cap. */
  overflow: number;
  /** Raw line/row count considered (excluding a CSV header). */
  consideredCount: number;
}

export interface PlanLimits {
  /** Max distinct fqdn items to keep. */
  maxItems: number;
  /** Max TLDs a bare label may be expanded across. */
  maxTlds: number;
}

export const DEFAULT_PLAN_LIMITS: PlanLimits = { maxItems: 3000, maxTlds: 20 };

/** Split pasted text into candidate tokens (newline / comma / semicolon / space). */
export function splitTokens(text: string): string[] {
  return text
    .split(/[\r\n,;\t ]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function dedupeTlds(tlds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tlds) {
    const t = normalizeTld(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

interface AddResult {
  added: boolean;
  duplicate: boolean;
}

function makeAdder(items: PlannedItem[], seen: Set<string>) {
  return (sld: string, tld: string): AddResult => {
    const fqdn = `${sld}${tld}`;
    if (seen.has(fqdn)) return { added: false, duplicate: true };
    seen.add(fqdn);
    items.push({ sld, tld });
    return { added: true, duplicate: false };
  };
}

/**
 * Plan a job from raw pasted text plus a requested TLD list.
 * Pure: identical input always yields identical output.
 */
export function planFromPaste(
  raw: string,
  requestedTlds: string[],
  limits: PlanLimits = DEFAULT_PLAN_LIMITS,
): PlanResult {
  const tlds = dedupeTlds(requestedTlds).slice(0, limits.maxTlds);
  const items: PlannedItem[] = [];
  const rejected: RejectedLine[] = [];
  const seen = new Set<string>();
  const add = makeAdder(items, seen);
  let overflow = 0;

  const tokens = splitTokens(raw);
  const lines = raw.split(/\r\n|\r|\n/);
  const lineOf = new Map<string, number>();
  lines.forEach((l, i) => {
    const t = l.trim();
    if (t && !lineOf.has(t)) lineOf.set(t, i + 1);
  });

  for (const token of tokens) {
    const line = lineOf.get(token) ?? 0;
    if (token.includes(".")) {
      if (items.length >= limits.maxItems) {
        overflow++;
        continue;
      }
      const parsed = parseDomain(token);
      if (!parsed) {
        rejected.push({ line, value: token, reason: "Not a valid domain" });
        continue;
      }
      const r = add(parsed.sld, parsed.tld);
      if (r.duplicate) {
        rejected.push({ line, value: token, reason: "Duplicate domain" });
      }
      continue;
    }
    const sld = token.toLowerCase();
    if (!isValidLabel(sld)) {
      rejected.push({ line, value: token, reason: "Not a valid label" });
      continue;
    }
    if (tlds.length === 0) {
      rejected.push({
        line,
        value: token,
        reason: "No extensions selected for bare labels",
      });
      continue;
    }
    for (const tld of tlds) {
      if (items.length >= limits.maxItems) {
        overflow++;
        continue;
      }
      const r = add(sld, tld);
      if (r.duplicate) {
        rejected.push({
          line,
          value: `${sld}${tld}`,
          reason: "Duplicate domain",
        });
      }
    }
  }

  return { items, rejected, overflow, consideredCount: tokens.length };
}

/**
 * Plan a job from CSV text. The CSV must have a "domain" column; a bare label
 * with no dot is allowed and is expanded across the requested TLDs. Any extra
 * columns are ignored here (availability is the only job kind today).
 */
export function planFromCsv(
  text: string,
  requestedTlds: string[],
  limits: PlanLimits = DEFAULT_PLAN_LIMITS,
): PlanResult {
  const parsed = parseCsv(text, { maxRows: limits.maxItems * limits.maxTlds });
  if (!parsed.headers.includes("domain")) {
    throw new CsvError("Missing required column: domain");
  }
  const tlds = dedupeTlds(requestedTlds).slice(0, limits.maxTlds);
  const items: PlannedItem[] = [];
  const rejected: RejectedLine[] = [];
  const seen = new Set<string>();
  const add = makeAdder(items, seen);
  let overflow = parsed.skippedRows;

  for (let i = 0; i < parsed.rows.length; i++) {
    const line = i + 2; // header is row 1
    const value = (parsed.rows[i].domain ?? "").trim();
    if (!value) {
      rejected.push({ line, value, reason: "Empty domain value" });
      continue;
    }
    if (value.includes(".")) {
      if (items.length >= limits.maxItems) {
        overflow++;
        continue;
      }
      const parsedDomain = parseDomain(value);
      if (!parsedDomain) {
        rejected.push({ line, value, reason: "Not a valid domain" });
        continue;
      }
      const r = add(parsedDomain.sld, parsedDomain.tld);
      if (r.duplicate) rejected.push({ line, value, reason: "Duplicate domain" });
      continue;
    }
    const sld = value.toLowerCase();
    if (!isValidLabel(sld)) {
      rejected.push({ line, value, reason: "Not a valid label" });
      continue;
    }
    if (tlds.length === 0) {
      rejected.push({
        line,
        value,
        reason: "No extensions selected for bare labels",
      });
      continue;
    }
    for (const tld of tlds) {
      if (items.length >= limits.maxItems) {
        overflow++;
        continue;
      }
      const r = add(sld, tld);
      if (r.duplicate) {
        rejected.push({ line, value: `${sld}${tld}`, reason: "Duplicate domain" });
      }
    }
  }

  return { items, rejected, overflow, consideredCount: parsed.rows.length };
}
