import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildPostgresSchema,
  CANONICAL_SCHEMA,
  POSTGRES_SCHEMA,
  SQLITE_PROVIDER,
} from "../scripts/prisma-schema";

// Guards the dual-schema contract: prisma/postgres/schema.prisma must always be
// the canonical prisma/schema.prisma with only the datasource provider swapped.
// If this fails, run `npm run db:sync-schema`.

describe("dual Prisma schema parity", () => {
  it("postgres schema equals the canonical sqlite schema with only the provider swapped", () => {
    const canonical = readFileSync(CANONICAL_SCHEMA, "utf8");
    const committed = readFileSync(POSTGRES_SCHEMA, "utf8");
    expect(committed).toBe(buildPostgresSchema(canonical));
  });

  it("canonical schema declares the SQLite provider exactly once", () => {
    const canonical = readFileSync(CANONICAL_SCHEMA, "utf8");
    expect(canonical.split(SQLITE_PROVIDER)).toHaveLength(2);
  });
});
