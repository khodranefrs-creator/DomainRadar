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

- Local Next.js app bound to `127.0.0.1` only by default. Remote access requires
  an explicit, token-gated deployment mode (see below).
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

## Deployment / remote access

The app is local-first and, by default, only answers requests whose `Host` header
is loopback (`localhost`, `127.0.0.1`, `::1`). Anything else gets
`403 Forbidden: Domain Radar is local-only.`

For personal remote access there is an explicit, opt-in **deployment mode**,
controlled by environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DOMAIN_RADAR_ACCESS_MODE` | `local` | `local` or `deployment`. Any other value is treated as `local`. |
| `DOMAIN_RADAR_ACCESS_TOKEN` | — | Shared access token (HTTP Basic auth password). **Required** in deployment mode. |
| `DOMAIN_RADAR_ACCESS_USER` | `domain-radar` | HTTP Basic auth username in deployment mode. |

Deployment mode rules:

- The `Host` header is **never** used as the access boundary — it is trivial to
  spoof. Every request must present the token via HTTP Basic auth
  (constant-time compared), or it gets `401` with a `WWW-Authenticate` challenge.
- If deployment mode is on but `DOMAIN_RADAR_ACCESS_TOKEN` is unset, the app
  **fails closed** with `503` instead of serving anything unauthenticated.
- Local mode ignores the token entirely: supplying credentials never bypasses the
  loopback guard.
- Generate a token with `openssl rand -base64 32` and set it as a Vercel project
  environment variable. Never commit it.

Set `DOMAIN_RADAR_ACCESS_MODE=deployment` and `DOMAIN_RADAR_ACCESS_TOKEN=...` in
the host's environment (e.g. Vercel → Project → Settings → Environment Variables),
then redeploy.

> **Database caveat.** SQLite cannot persist on serverless hosts like Vercel —
> the `data/domain-radar.db` file is git-ignored and is not present in a fresh
> deployment, so pages that read the database will fail even behind the access
> gate. A real deployment needs a hosted Postgres (and the Prisma datasource
> switched to `postgresql`). Do not enable deployment mode on a public host until
> that is set up.

**Deployment status: paused — the project runs local-only.** The deployment-mode
code and tests are kept so a future deploy is a configuration change, not a
rewrite, but deployment is intentionally **not** enabled and the app has **not**
migrated off SQLite. Nothing in the current configuration weakens the local-only
guard: local mode is the default, `.env` does not set `DOMAIN_RADAR_ACCESS_MODE`,
and there is no `vercel.json`/`.npmrc` that alters it.

**Future PostgreSQL migration.** Keep it minimal: switch the `datasource`
`provider` in `prisma/schema.prisma` to `postgresql`, point `DATABASE_URL` at the
hosted instance, run `npx prisma migrate deploy`, and seed. All database access
already goes through Prisma and the repositories in `src/lib`, so no new
abstractions are needed.

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
