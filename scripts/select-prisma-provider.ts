// Generates the Prisma client that matches the effective DATABASE_URL.
//
// Local development uses SQLite (prisma/schema.prisma). Vercel production sets a
// postgres:// DATABASE_URL and therefore generates the PostgreSQL client from the
// generated schema. Only the URL *scheme* is inspected — no credentials are read,
// logged, or transmitted.
//
// Used by `npm run dev`, `npm run build` and `npm test`.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function readDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Next loads .env files itself; bare node/npm scripts do not. Match Next's
  // precedence (.env.local overrides .env).
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const url = readDatabaseUrl();
const isPostgres = /^postgres(ql)?:/.test(url);
const schema = isPostgres ? "prisma/postgres/schema.prisma" : "prisma/schema.prisma";
console.log(
  `[prisma] DATABASE_URL scheme resolves to ${isPostgres ? "postgresql" : "sqlite"}; ` +
    `generating client from ${schema}`,
);

const result = spawnSync("npx", ["prisma", "generate", `--schema=${schema}`], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
