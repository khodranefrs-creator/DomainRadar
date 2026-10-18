// Verified TLD catalog. Every rdapBaseUrl here was confirmed with a live
// request on 2026-10-18. TLDs without a verified endpoint are marked
// UNSUPPORTED — they are surfaced explicitly, never silently omitted.

import { TldStatus, type TldStatus as TldStatusType } from "./enums";

export interface TldSeed {
  tld: string;
  displayName: string;
  rdapBaseUrl: string | null;
  bootstrapUrl: string | null;
  status: TldStatusType;
  supportsHead: boolean;
  isDefault: boolean;
  priority: number;
  registryName: string | null;
  termsUrl: string | null;
  verifiedAt: Date | null;
  notes: string | null;
}

const IANA_BOOTSTRAP = "https://data.iana.org/rdap/dns.json";
const VERIFIED_AT = new Date("2026-10-18T00:00:00.000Z");

export const TLD_CATALOG: TldSeed[] = [
  {
    tld: ".com",
    displayName: "Commercial",
    rdapBaseUrl: "https://rdap.verisign.com/com/v1/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: true,
    priority: 10,
    registryName: "Verisign",
    termsUrl: "https://www.verisign.com/en_US/domain-names/",
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18: 200 registered / 404 not found.",
  },
  {
    tld: ".ai",
    displayName: "Anguilla / AI",
    rdapBaseUrl: "https://rdap.identitydigital.services/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: true,
    priority: 20,
    registryName: "Identity Digital (for .ai registry)",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18: 200 registered / 404 not found.",
  },
  {
    tld: ".si",
    displayName: "Slovenia",
    rdapBaseUrl: "https://rdap.register.si/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: true,
    priority: 30,
    registryName: "Register.si",
    termsUrl: "https://www.register.si/en/rdap/",
    verifiedAt: VERIFIED_AT,
    notes:
      "Live-verified 2026-10-18: 200 registered / 404 not found. Anonymous queries hide holder data.",
  },
  {
    tld: ".io",
    displayName: "British Indian Ocean Territory",
    rdapBaseUrl: "https://rdap.identitydigital.services/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 40,
    registryName: "Identity Digital",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes:
      "Live-verified 2026-10-18 via Identity Digital. Not listed in IANA dns.json bootstrap but resolves correctly.",
  },
  {
    tld: ".app",
    displayName: "Applications",
    rdapBaseUrl: "https://pubapi.registry.google/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 50,
    registryName: "Google Registry",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18: 200 registered / 404 not found. HTTPS-only TLD.",
  },
  {
    tld: ".dev",
    displayName: "Developers",
    rdapBaseUrl: "https://pubapi.registry.google/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 60,
    registryName: "Google Registry",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18. HTTPS-only TLD.",
  },
  {
    tld: ".net",
    displayName: "Network",
    rdapBaseUrl: "https://rdap.verisign.com/net/v1/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 70,
    registryName: "Verisign",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18: 200 registered / 404 not found.",
  },
  {
    tld: ".org",
    displayName: "Organization",
    rdapBaseUrl: "https://rdap.publicinterestregistry.org/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 80,
    registryName: "Public Interest Registry",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18: 200 registered / 404 not found.",
  },
  {
    tld: ".xyz",
    displayName: "XYZ",
    rdapBaseUrl: "https://rdap.centralnic.com/xyz/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 90,
    registryName: "CentralNic",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18: 200 registered / 404 not found.",
  },
  {
    tld: ".tech",
    displayName: "Technology",
    rdapBaseUrl: "https://rdap.radix.host/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 100,
    registryName: "Radix",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18: 200 registered / 404 not found.",
  },
  {
    tld: ".cloud",
    displayName: "Cloud",
    rdapBaseUrl: "https://rdap.registry.cloud/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 110,
    registryName: ".cloud registry",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18: 200 registered / 404 not found.",
  },
  {
    tld: ".online",
    displayName: "Online",
    rdapBaseUrl: "https://rdap.radix.host/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 120,
    registryName: "Radix",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18 via Radix.",
  },
  {
    tld: ".site",
    displayName: "Site",
    rdapBaseUrl: "https://rdap.radix.host/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 130,
    registryName: "Radix",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18 via Radix.",
  },
  {
    tld: ".store",
    displayName: "Store",
    rdapBaseUrl: "https://rdap.radix.host/rdap/",
    bootstrapUrl: IANA_BOOTSTRAP,
    status: TldStatus.AVAILABLE,
    supportsHead: true,
    isDefault: false,
    priority: 140,
    registryName: "Radix",
    termsUrl: null,
    verifiedAt: VERIFIED_AT,
    notes: "Live-verified 2026-10-18 via Radix.",
  },
  {
    tld: ".co",
    displayName: "Colombia",
    rdapBaseUrl: null,
    bootstrapUrl: null,
    status: TldStatus.UNSUPPORTED,
    supportsHead: false,
    isDefault: false,
    priority: 900,
    registryName: "CCI (.CO Internet)",
    termsUrl: null,
    verifiedAt: null,
    notes:
      "No RDAP endpoint in the IANA bootstrap as of 2026-10-18. Marked UNSUPPORTED — do not guess endpoints.",
  },
  {
    tld: ".me",
    displayName: "Montenegro",
    rdapBaseUrl: null,
    bootstrapUrl: null,
    status: TldStatus.UNSUPPORTED,
    supportsHead: false,
    isDefault: false,
    priority: 901,
    registryName: "Domain.me",
    termsUrl: null,
    verifiedAt: null,
    notes:
      "No RDAP endpoint in the IANA bootstrap as of 2026-10-18. Marked UNSUPPORTED.",
  },
];

export function getTld(tld: string): TldSeed | undefined {
  const normalized = normalizeTld(tld);
  return TLD_CATALOG.find((t) => t.tld === normalized);
}

/** Normalize a TLD to canonical form: lowercase, single leading dot, no trailing dot. */
export function normalizeTld(input: string): string {
  let t = input.trim().toLowerCase();
  t = t.replace(/^\.+/, "").replace(/\.+$/, "");
  return t.length ? `.${t}` : "";
}
