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

npm run db:deploy:sqlite   # apply SQLite migrations
npm run db:seed            # seed TLD + source registries

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
| `DOMAIN_RADAR_ACCESS_TOKEN` | — | Shared secret. **Required** in deployment mode; used as the login password and as the session-cookie signing key. |
| `DOMAIN_RADAR_ACCESS_USER` | `domain-radar` | HTTP Basic auth username (API/CLI clients only). |

Deployment mode rules:

- The `Host` header is **never** used as the access boundary — it is trivial to
  spoof.
- Anonymous page visits are redirected to `/login` with **no** `WWW-Authenticate`
  header, so the browser shows no Basic-auth prompt. `/login` sets a signed,
  HttpOnly session cookie (`HMAC-SHA256` keyed by the token) on the correct
  password; afterwards the cookie is sent automatically on every navigation and
  fetch, so the password is entered once per browser.
- Every page **and** every `/api/*` route still requires that session (or HTTP
  Basic credentials, for scripts). Unauthenticated `/api/*` requests get a plain
  `401`.
- Only `/login`, `/api/auth/login`, `/api/auth/logout` and Next's static assets
  are reachable without a session — none of them expose application data, the
  database, or the RDAP scanning endpoint.
- If deployment mode is on but `DOMAIN_RADAR_ACCESS_TOKEN` is unset, protected
  paths **fail closed** with `503`; the login page still loads so it can report the
  misconfiguration.
- Local mode is unchanged: loopback-only, and neither a session cookie nor
  credentials can bypass the guard.
- Generate a token with `openssl rand -base64 32` and set it as a Vercel project
  environment variable. Never commit it.

Set `DOMAIN_RADAR_ACCESS_MODE=deployment` and `DOMAIN_RADAR_ACCESS_TOKEN=...` in
the host's environment (e.g. Vercel → Project → Settings → Environment Variables),
then redeploy.

### Dual database — SQLite local · PostgreSQL production

SQLite cannot persist on serverless hosts like Vercel, so production uses
PostgreSQL. Prisma fixes the datasource provider per schema file, so the project
keeps two:

| File | Provider | Used by |
| --- | --- | --- |
| `prisma/schema.prisma` | SQLite | local dev, `npm test` |
| `prisma/postgres/schema.prisma` | PostgreSQL | Vercel production, `npm run test:postgres` |

`prisma/schema.prisma` is the **single source of truth** for every model.
`prisma/postgres/schema.prisma` is **generated** from it by `npm run db:sync-schema`
and must differ *only* in the datasource provider; `tests/schema-parity.test.ts`
fails the build if the two ever drift. Never hand-edit the generated file.

Regression is guarded: `scripts/select-prisma-provider.ts` generates the Prisma
client that matches the effective `DATABASE_URL` (via `npm run dev`, `npm run build`,
`npm test`), and the SQLite/PostgreSQL integration tests in `tests/` each gate on
the provider that is actually generated — neither run is silently dropped.

```bash
npm run db:sync-schema      # regenerate prisma/postgres/schema.prisma after editing prisma/schema.prisma
npm run db:deploy:sqlite    # local SQLite migrations (== `prisma migrate deploy`)
npm run db:migrate          # local dev migrations (SQLite)
npm run db:deploy           # production PostgreSQL migrations (needs production DATABASE_URL)
npm run db:seed             # seed TLD + source registries (matches the generated client)
```

`npm run test:postgres` runs the whole suite with the PostgreSQL client generated.
If `TEST_DATABASE_URL` is set it points the PostgreSQL test at that server; the
test always forces its own `domain_radar_test` schema, so production data is never
touched — the test creates and cleans up its own rows there.

**Deployment status.** The app is deployed and runs in **deployment mode** behind
a login: every page and API requires a session, anonymous visitors are redirected
to `/login` (no browser Basic-auth prompt), and nothing is publicly readable.
Local development stays loopback-only by default. The database credentials and the
access token are never sent to the client.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on `127.0.0.1:3000` (generates the matching Prisma client first) |
| `npm run build` | Production build (uses webpack — see note) |
| `npm run start` | Production server on `127.0.0.1:3000` |
| `npm test` | Vitest suite with the SQLite client (runs `tests/db.test.ts`) |
| `npm run test:postgres` | Vitest suite with the PostgreSQL client (runs `tests/db.postgres.test.ts`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:sync-schema` | Regenerate the PostgreSQL Prisma schema from the canonical SQLite schema |
| `npm run db:generate` | Generate the Prisma client for the effective `DATABASE_URL` |
| `npm run db:deploy` / `db:deploy:sqlite` | Apply PostgreSQL / SQLite migrations |
| `npm run db:seed` | Seed TLD + source registries |
| `npx tsx tests/live/rdap-smoke.ts` | Live RDAP smoke test (real network, low volume) |

The live smoke test is **not** part of the unit run (`tests/live` is excluded by
`vitest.config.mts`). It performs a handful of real, rate-limited requests
against public registry endpoints and writes nothing to the database.

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
