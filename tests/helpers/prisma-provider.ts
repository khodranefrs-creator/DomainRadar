import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type DbProvider = "sqlite" | "postgresql" | "unknown";

const GENERATED_SCHEMA = path.resolve(
  process.cwd(),
  "node_modules/.prisma/client/schema.prisma",
);

/**
 * Datasource provider of the Prisma client that is currently generated.
 *
 * The client is regenerated for the active database by
 * scripts/select-prisma-provider.ts, so the SQLite and PostgreSQL DB tests gate
 * on this value instead of being skipped implicitly: `npm test` exercises SQLite,
 * `npm run test:postgres` exercises PostgreSQL, and neither silently disappears.
 */
export function getGeneratedProvider(): DbProvider {
  if (!existsSync(GENERATED_SCHEMA)) return "unknown";
  const match = readFileSync(GENERATED_SCHEMA, "utf8").match(
    /provider\s*=\s*"(sqlite|postgresql)"/,
  );
  return (match?.[1] as DbProvider | undefined) ?? "unknown";
}
