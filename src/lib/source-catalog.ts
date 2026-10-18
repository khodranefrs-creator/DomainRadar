// Source registry catalog. This is the single source of truth for which
// providers exist and whether they are actually operational. A planned adapter
// is NEVER represented as AVAILABLE.

import { SourceKind, SourceStatus } from "./enums";

export interface SourceSeed {
  key: string;
  name: string;
  kind: string;
  status: string;
  termsUrl: string | null;
  permittedUseNotes: string | null;
  attributionRequired: boolean;
  attributionText: string | null;
  requiresAuth: boolean;
  rateLimitPerMinute: number | null;
  cacheTtlSeconds: number;
  timeoutMs: number;
  maxRetries: number;
}

export const SOURCE_CATALOG: SourceSeed[] = [
  {
    key: "rdap_register_si",
    name: "Register.si RDAP",
    kind: SourceKind.RDAP,
    status: SourceStatus.AVAILABLE,
    termsUrl: "https://www.register.si/en/rdap/",
    permittedUseNotes:
      "Official public RDAP server for .si. Anonymous queries return no holder data.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null, // not documented; enforce conservative default
    cacheTtlSeconds: 3600,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    key: "rdap_verisign_com",
    name: "Verisign RDAP (.com)",
    kind: SourceKind.RDAP,
    status: SourceStatus.AVAILABLE,
    termsUrl: "https://www.verisign.com/en_US/domain-names/",
    permittedUseNotes: "Official Verisign RDAP for .com.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 3600,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    key: "rdap_verisign_net",
    name: "Verisign RDAP (.net)",
    kind: SourceKind.RDAP,
    status: SourceStatus.AVAILABLE,
    termsUrl: "https://www.verisign.com/en_US/domain-names/",
    permittedUseNotes: "Official Verisign RDAP for .net.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 3600,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    key: "rdap_identity_digital",
    name: "Identity Digital RDAP",
    kind: SourceKind.RDAP,
    status: SourceStatus.AVAILABLE,
    termsUrl: null,
    permittedUseNotes:
      "Serves .ai, .io and many gTLDs. Live-verified for .ai and .io on 2026-10-18.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 3600,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    key: "rdap_google_registry",
    name: "Google Registry RDAP",
    kind: SourceKind.RDAP,
    status: SourceStatus.AVAILABLE,
    termsUrl: "https://www.registry.google/",
    permittedUseNotes: "Official Google Registry RDAP for .app and .dev.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 3600,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    key: "rdap_pir_org",
    name: "Public Interest Registry RDAP (.org)",
    kind: SourceKind.RDAP,
    status: SourceStatus.AVAILABLE,
    termsUrl: "https://www.pir.org/",
    permittedUseNotes: "Official PIR RDAP for .org.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 3600,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    key: "rdap_radix",
    name: "Radix RDAP (.tech/.online/.site/.store)",
    kind: SourceKind.RDAP,
    status: SourceStatus.AVAILABLE,
    termsUrl: null,
    permittedUseNotes: "Official Radix RDAP server.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 3600,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    key: "rdap_centralnic_xyz",
    name: "CentralNic RDAP (.xyz)",
    kind: SourceKind.RDAP,
    status: SourceStatus.AVAILABLE,
    termsUrl: null,
    permittedUseNotes: "Official CentralNic RDAP for .xyz.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 3600,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    key: "rdap_registry_cloud",
    name: "RDAP (.cloud)",
    kind: SourceKind.RDAP,
    status: SourceStatus.AVAILABLE,
    termsUrl: null,
    permittedUseNotes: "Official .cloud registry RDAP.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 3600,
    timeoutMs: 10000,
    maxRetries: 2,
  },
  {
    key: "iana_rdap_bootstrap",
    name: "IANA RDAP Bootstrap",
    kind: SourceKind.DATASET,
    status: SourceStatus.AVAILABLE,
    termsUrl: "https://data.iana.org/rdap/",
    permittedUseNotes: "Authoritative bootstrap registry mapping TLDs to RDAP servers.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 86400,
    timeoutMs: 15000,
    maxRetries: 2,
  },
  {
    key: "namebio_retailstats",
    name: "NameBio RetailStats (free)",
    kind: SourceKind.API,
    status: SourceStatus.AVAILABLE,
    termsUrl: "https://api.namebio.com/docs/",
    permittedUseNotes:
      "Free, no auth. 4 requests/minute, no multi-threading. Attribution with link required. Cache >=24h recommended.",
    attributionRequired: true,
    attributionText:
      "Market data provided by NameBio.com — https://namebio.com",
    requiresAuth: false,
    rateLimitPerMinute: 4,
    cacheTtlSeconds: 86400,
    timeoutMs: 20000,
    maxRetries: 1,
  },
  {
    key: "namebio_tldstats",
    name: "NameBio TLDStats (free)",
    kind: SourceKind.API,
    status: SourceStatus.AVAILABLE,
    termsUrl: "https://api.namebio.com/docs/",
    permittedUseNotes:
      "Free, no auth. 4 requests/minute, no multi-threading. Attribution with link required. Cache >=24h recommended.",
    attributionRequired: true,
    attributionText:
      "Market data provided by NameBio.com — https://namebio.com",
    requiresAuth: false,
    rateLimitPerMinute: 4,
    cacheTtlSeconds: 86400,
    timeoutMs: 20000,
    maxRetries: 1,
  },
  {
    key: "tmview",
    name: "TMview",
    kind: SourceKind.PORTAL,
    status: SourceStatus.MANUAL_ONLY,
    termsUrl: "https://www.tmdn.org/tmview/",
    permittedUseNotes:
      "Manual preliminary trademark checks only. No automated querying.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 0,
    timeoutMs: 0,
    maxRetries: 0,
  },
  {
    key: "wipo_global_brand_db",
    name: "WIPO Global Brand Database",
    kind: SourceKind.PORTAL,
    status: SourceStatus.MANUAL_ONLY,
    termsUrl: "https://www.wipo.int/branddb/en/",
    permittedUseNotes:
      "WIPO terms prohibit automated queries and scraping. Manual review only — deep-link to the official UI.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 0,
    timeoutMs: 0,
    maxRetries: 0,
  },
  {
    key: "google_trends_manual",
    name: "Google Trends (manual CSV export)",
    kind: SourceKind.MANUAL,
    status: SourceStatus.MANUAL_ONLY,
    termsUrl: "https://trends.google.com/",
    permittedUseNotes:
      "User-exported CSVs only. No scraping. RequiresData: export must carry region and date range.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 0,
    timeoutMs: 0,
    maxRetries: 0,
  },
  {
    key: "rss_feeds",
    name: "RSS / Atom feeds (user-approved)",
    kind: SourceKind.RSS,
    status: SourceStatus.NEEDS_CONFIGURATION,
    termsUrl: null,
    permittedUseNotes:
      "Only feeds whose terms permit automated retrieval. User must add and approve each feed.",
    attributionRequired: true,
    attributionText: "Article source and publisher preserved per feed.",
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 3600,
    timeoutMs: 15000,
    maxRetries: 2,
  },
  {
    key: "github_api",
    name: "GitHub REST API",
    kind: SourceKind.API,
    status: SourceStatus.NEEDS_CONFIGURATION,
    termsUrl: "https://docs.github.com/en/rest",
    permittedUseNotes:
      "Documented API only; verify current rate limits and terms before enabling.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 86400,
    timeoutMs: 15000,
    maxRetries: 1,
  },
  {
    key: "hackernews_api",
    name: "Hacker News API",
    kind: SourceKind.API,
    status: SourceStatus.NEEDS_CONFIGURATION,
    termsUrl: "https://github.com/HackerNews/API",
    permittedUseNotes: "Official public API; verify current limits before enabling.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 86400,
    timeoutMs: 15000,
    maxRetries: 1,
  },
  {
    key: "common_crawl",
    name: "Common Crawl Index",
    kind: SourceKind.DATASET,
    status: SourceStatus.NEEDS_CONFIGURATION,
    termsUrl: "https://commoncrawl.org/",
    permittedUseNotes:
      "Historical research only — NOT a real-time availability service. Verify index terms before enabling.",
    attributionRequired: false,
    attributionText: null,
    requiresAuth: false,
    rateLimitPerMinute: null,
    cacheTtlSeconds: 604800,
    timeoutMs: 30000,
    maxRetries: 0,
  },
];

export async function syncSources(prisma: import("@prisma/client").PrismaClient) {
  let created = 0;
  let updated = 0;
  for (const seed of SOURCE_CATALOG) {
    const existing = await prisma.source.findUnique({ where: { key: seed.key } });
    const data = {
      name: seed.name,
      kind: seed.kind,
      status: seed.status,
      termsUrl: seed.termsUrl,
      permittedUseNotes: seed.permittedUseNotes,
      attributionRequired: seed.attributionRequired,
      attributionText: seed.attributionText,
      requiresAuth: seed.requiresAuth,
      rateLimitPerMinute: seed.rateLimitPerMinute,
      cacheTtlSeconds: seed.cacheTtlSeconds,
      timeoutMs: seed.timeoutMs,
      maxRetries: seed.maxRetries,
    };
    if (existing) {
      await prisma.source.update({ where: { key: seed.key }, data });
      updated++;
    } else {
      await prisma.source.create({ data: { key: seed.key, ...data } });
      created++;
    }
  }
  return { created, updated };
}
