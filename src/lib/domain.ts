// Domain normalization & parsing. Pure functions, no I/O — unit tested.

const LABEL_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** True when a string is a valid DNS label (1-63 chars, no leading/trailing hyphen). */
export function isValidLabel(label: string): boolean {
  return label.length >= 1 && label.length <= 63 && LABEL_RE.test(label);
}

/** Normalize a possible SLD string: trim, lowercase, strip surrounding dots. */
export function normalizeSld(input: string): string | null {
  const sld = input.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
  return isValidLabel(sld) ? sld : null;
}

/** Normalize a possible TLD string into canonical ".x" form. */
export function normalizeTld(input: string): string | null {
  const t = input.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
  if (!/^[a-z0-9][a-z0-9-]{0,61}$/.test(t)) return null;
  return `.${t}`;
}

/** Build a normalized FQDN from SLD + TLD. Returns null when either is invalid. */
export function buildFqdn(
  sldInput: string,
  tldInput: string,
): { sld: string; tld: string; fqdn: string } | null {
  const sld = normalizeSld(sldInput);
  const tld = normalizeTld(tldInput);
  if (!sld || !tld) return null;
  return { sld, tld, fqdn: `${sld}${tld}` };
}

/** Parse a full domain like "AgentCapability.SI" into normalized parts. */
export function parseDomain(
  input: string,
): { sld: string; tld: string; fqdn: string } | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed.includes(".")) return null;
  const lastDot = trimmed.lastIndexOf(".");
  const sldPart = trimmed.slice(0, lastDot);
  const tldPart = trimmed.slice(lastDot + 1);
  if (!sldPart || !tldPart) return null;
  if (sldPart.includes(".")) return null; // no subdomains in this system
  return buildFqdn(sldPart, tldPart);
}
