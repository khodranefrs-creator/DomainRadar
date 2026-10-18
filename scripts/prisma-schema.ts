// Shared helpers for the dual Prisma schema setup.
//
// prisma/schema.prisma (SQLite) is the canonical model definition used for local
// development. prisma/postgres/schema.prisma (PostgreSQL) is generated from it by
// swapping ONLY the datasource provider, and is what Vercel production builds
// against. Keeping the transform here means the generator script and the parity
// test can never disagree about what "in sync" means.

import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const CANONICAL_SCHEMA = fileURLToPath(
  new URL("../prisma/schema.prisma", import.meta.url),
);
export const POSTGRES_SCHEMA = fileURLToPath(
  new URL("../prisma/postgres/schema.prisma", import.meta.url),
);

export const SQLITE_PROVIDER = 'provider = "sqlite"';
export const POSTGRES_PROVIDER = 'provider = "postgresql"';

/**
 * Produce the PostgreSQL schema from the canonical SQLite schema. The ONLY
 * permitted difference is the datasource provider declaration.
 */
export function buildPostgresSchema(canonical: string): string {
  const occurrences = canonical.split(SQLITE_PROVIDER).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `Expected exactly one '${SQLITE_PROVIDER}' in prisma/schema.prisma, found ${occurrences}. ` +
        "The dual-schema sync depends on a single datasource provider declaration.",
    );
  }
  return canonical.replace(SQLITE_PROVIDER, POSTGRES_PROVIDER);
}
