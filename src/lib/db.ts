import { PrismaClient } from "@prisma/client";

// Singleton Prisma client. Reused across hot reloads in development to avoid
// exhausting SQLite connections. This is the ONLY approved way to reach the DB —
// feature code must go through repositories in src/lib/repositories.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
