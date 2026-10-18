# Domain Radar

A local-first, evidence-first domain investment research platform. It helps you
find, verify and decide on domain names before you spend money — without paid
APIs, scraping, or guessed data.

Two rules drive the whole project:

1. **Never invent data.** Anything not confirmed by a live source is shown as
   `UNKNOWN`/`NEEDS_VERIFICATION`, never as "available".
2. **Multi-TLD from day one.** A name is evaluated across every verified
   extension at once, not just `.com`.

## Status — Milestone 1

- Local Next.js app bound to `127.0.0.1` only. Nothing is deployed.
- SQLite database via Prisma (`data/domain-radar.db`).
- Multi-TLD schema: `TldRegistry`, `DomainSearchSession`, `DomainVariantCheck`,
  candidates, evidence, sources, settings and more.
- Candidate CSV import/export with formula-injection sanitisation.
- Scanner enumerates variants for a name across verified TLDs and records a
  session. **Live RDAP availability checks land in Milestone 2** — the scanner
  reports honest `PENDING` statuses until then.
- Source + TLD registries seeded from live-verified catalogs.

## Requirements

- Node.js 20+ (developed on v24)
- npm

## Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env

npx prisma migrate deploy
npx tsx prisma/seed.ts

npm run dev
```

Open http://127.0.0.1:3000

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on `127.0.0.1:3000` |
| `npm run build` | Production build (uses webpack — see note) |
| `npm run start` | Production server on `127.0.0.1:3000` |
| `npm test` | Vitest unit suite |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
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
  live request on 2026-10-18. `.co` and `.me` are `UNSUPPORTED` (no IANA
  bootstrap entry); they are never silently omitted or guessed.
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
