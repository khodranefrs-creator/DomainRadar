// Regenerates prisma/postgres/schema.prisma from the canonical SQLite schema.
// Run `npm run db:sync-schema` after every change to prisma/schema.prisma.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildPostgresSchema, CANONICAL_SCHEMA, POSTGRES_SCHEMA } from "./prisma-schema";

const canonical = readFileSync(CANONICAL_SCHEMA, "utf8");
const generated = buildPostgresSchema(canonical);
mkdirSync(dirname(POSTGRES_SCHEMA), { recursive: true });
writeFileSync(POSTGRES_SCHEMA, generated);
console.log(`Wrote ${POSTGRES_SCHEMA} with provider = "postgresql"`);
