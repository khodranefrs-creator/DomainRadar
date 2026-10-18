# Domain Radar

A local-first, evidence-first domain investment research platform. It helps you
find, verify and decide on domain names before you spend money — without paid
APIs, scraping, or guessed data.

Two rules drive the whole project:

1. **Never invent data.** Anything not confirmed by a live source is shown as
   `UNKNOWN`/`NEEDS_VERIFICATION`, never as "available".
2. **Multi-TLD from day one.** A name is evaluated across every verified
   extension at once, not just `.com`.

## Status — Milestone 2 (live RDAP availability)

- Local Next.js app bound to `127.0.0.1` only. Nothing is deployed.
- SQLite database via Prisma (`data/domain-radar.db`).
- Multi-TLD schema: `TldRegistry`, `DomainSearchSession`, `DomainVariantCheck`,
  candidates, evidence, sources, settings and more.
- Candidate CSV import/export with formula-injection sanitisation.
- **Live RDAP availability checks.** The scanner resolves each extension through
  the IANA RDAP bootstrap (`https://data.iana.org/rdap/dns.json`, cached 24h) and
  queries the registry's own RDAP service server-side. No endpoint is guessed.
- Every check is persisted to `DomainVariantCheck` with audit metadata:
  provider host, request URL, HTTP status, raw + normalized status, error kind,
  response time, and the freshness window. Results are served from cache within
  the source TTL.
- Source + TLD registries seeded from live-verified catalogs.

### Availability statuses

Each variant ends in exactly one of these — none of them is a synthetic
"available" state:

| Status | Meaning |
| --- | --- |
| `REGISTERED` | RDAP returned a domain record (the name is taken). |
| `NOT_FOUND` | RDAP had no record. **Not** a guarantee the name can be registered. |
| `RATE_LIMITED` | Provider returned 429; result unknown until retried later. |
| `UNSUPPORTED` | No verified RDAP endpoint for this extension; no request made. |
| `UNKNOWN` / `NEEDS_VERIFICATION` | Insufficient evidence; never shown as available. |
| `ERROR` | Transport/HTTP failure (timeout, network, 5xx, malformed, SSRF-blocked). |

The name summary reports `requested`, `checked`, `registered`, `notFound`,
`unsupported`, `unresolved` and `error` counts, plus a session status
(`COMPLETED` / `PARTIAL` / `FAILED`).

## Requirements

- Node.js 24.x (declared via `engines.node` and `.nvmrc`; v24 is required by
  the Vitest 5 toolchain). CI/Vercel picks this up automatically.
- npm

## Setup

```bash
npm ci
cp .env.example .env

npx prisma migrate deploy
npx tsx prisma/seed.ts

npm run dev
```

Open http://127.0.0.1:3000

> The dependency tree resolves cleanly under a strict `npm install` / `npm ci`
> (no `--legacy-peer-deps` or `--force` needed). `@types/node` is pinned to the
> Node 24 line so it satisfies the peer requirements of both `vitest` and `vite`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on `127.0.0.1:3000` |
| `npm run build` | Production build (uses webpack — see note) |
| `npm run start` | Production server on `127.0.0.1:3000` |
| `npm test` | Vitest unit suite |
| `npx tsx tests/live/rdap-smoke.ts` | Live RDAP smoke test (real network, low volume) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |

The live smoke test is **not** part of the unit run (`tests/live` is excluded by
`vitest.config.mts`). It performs a handful of real, rate-limited requests
against public registry endpoints and writes nothing to the database.
| `npx tsx prisma/seed.ts` | Seed TLD + source registries |

### Build note (Windows)

`npm run build` runs `next build --webpack`. Next 16's default Turbopack build
creates a junction point under `.next/` for `@prisma/client` and fails with
`os error 5 (Access is denied)` on Windows without developer-mode symlink
privileges. Webpack builds without that step. Drop `--webpack` on macOS/Linux.

## Data sources and limitations

Every external source is registered with its permitted-use notes and current
status. Planned adapters are never shown as operational.

- **RDAP** (`.com`, `.net`, `.si`, `.ai`, `.io`, `.app`, `.dev`, `.org`, `.xyz`,
  `.tech`, `.online`, `.site`, `.store`, `.cloud`) — endpoints confirmed with a
  live request on 2026-10-18. Bases are resolved from the IANA bootstrap (or the
  verified catalog for TLDs like `.io` that the bootstrap omits). `.co` and `.me`
  are `UNSUPPORTED` (no IANA bootstrap entry); they are never silently omitted or
  guessed. Lookups are server-side only, go through an SSRF host allowlist
  (https-only), and use a per-provider rate limiter (~1 request/second), a 10s
  timeout and bounded retries with backoff for transient failures.
- **NameBio** — TLD/sales statistics, free endpoints, rate-limited to 4/min.
  Attribution and a link are required; results cached ≥24h.
- **WIPO Global Brand Database / TMview** — `MANUAL_ONLY`. Both prohibit
  automated querying, so trademark checks are performed by a human and recorded
  as evidence.
- **GitHub / Hacker News / Common Crawl** — Tier 2, `NEEDS_CONFIGURATION`.

A missing RDAP record is **not** proof a domain is available. Registrations can
be reserved, premium-priced, or trademark-restricted; unknown conditions stay
`UNKNOWN` until confirmed.

## Constraints

- $0–$10/month recurring budget; free and lawfully accessible sources only.
- No paid APIs, no bypassing paywalls, CAPTCHAs, robots rules or rate limits.
- No secrets committed. `.env` is git-ignored; `.env.example` is the template.
