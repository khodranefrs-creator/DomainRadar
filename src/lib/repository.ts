import { prisma } from "./db";
import { TLD_CATALOG } from "./tld-catalog";
import { TldStatus } from "./enums";
import type { UserSettingsInput } from "./schemas";

// Repository layer: the single seam between feature code and Prisma. Swapping
// SQLite for PostgreSQL later means changing the datasource, not feature code.

export const tldRepository = {
  async list() {
    return prisma.tldRegistry.findMany({ orderBy: [{ priority: "asc" }, { tld: "asc" }] });
  },

  async listAvailable() {
    return prisma.tldRegistry.findMany({
      where: { status: TldStatus.AVAILABLE },
      orderBy: [{ priority: "asc" }],
    });
  },

  async countByStatus() {
    const rows = await prisma.tldRegistry.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  },

  async getByTld(tld: string) {
    return prisma.tldRegistry.findUnique({ where: { tld } });
  },

  /** Seed/refresh the TLD registry from the verified catalog. Idempotent. */
  async syncFromCatalog() {
    let created = 0;
    let updated = 0;
    for (const seed of TLD_CATALOG) {
      const existing = await prisma.tldRegistry.findUnique({ where: { tld: seed.tld } });
      if (existing) {
        await prisma.tldRegistry.update({
          where: { tld: seed.tld },
          data: {
            rdapBaseUrl: seed.rdapBaseUrl,
            bootstrapUrl: seed.bootstrapUrl,
            status: seed.status,
            supportsHead: seed.supportsHead,
            priority: seed.priority,
            registryName: seed.registryName,
            termsUrl: seed.termsUrl,
            verifiedAt: seed.verifiedAt,
            notes: seed.notes,
          },
        });
        updated++;
      } else {
        await prisma.tldRegistry.create({
          data: {
            tld: seed.tld,
            displayName: seed.displayName,
            rdapBaseUrl: seed.rdapBaseUrl,
            bootstrapUrl: seed.bootstrapUrl,
            status: seed.status,
            supportsHead: seed.supportsHead,
            isDefault: seed.isDefault,
            priority: seed.priority,
            registryName: seed.registryName,
            termsUrl: seed.termsUrl,
            verifiedAt: seed.verifiedAt,
            notes: seed.notes,
          },
        });
        created++;
      }
    }
    return { created, updated };
  },

  /** Ensure a TLD row exists for an arbitrary extension; unknown => NEEDS_VERIFICATION. */
  async ensure(tld: string) {
    const existing = await prisma.tldRegistry.findUnique({ where: { tld } });
    if (existing) return existing;
    const seed = TLD_CATALOG.find((t) => t.tld === tld);
    if (seed) {
      return prisma.tldRegistry.create({
        data: {
          tld: seed.tld,
          displayName: seed.displayName,
          rdapBaseUrl: seed.rdapBaseUrl,
          bootstrapUrl: seed.bootstrapUrl,
          status: seed.status,
          supportsHead: seed.supportsHead,
          isDefault: seed.isDefault,
          priority: seed.priority,
          registryName: seed.registryName,
          termsUrl: seed.termsUrl,
          verifiedAt: seed.verifiedAt,
          notes: seed.notes,
        },
      });
    }
    return prisma.tldRegistry.create({
      data: {
        tld,
        displayName: tld.replace(/^\./, "").toUpperCase(),
        rdapBaseUrl: null,
        status: TldStatus.NEEDS_VERIFICATION,
        supportsHead: false,
        isDefault: false,
        priority: 999,
        notes: "Auto-registered from import; RDAP capability not yet verified.",
      },
    });
  },
};

export const settingsRepository = {
  async get() {
    const existing = await prisma.userSettings.findUnique({ where: { id: "singleton" } });
    if (existing) return existing;
    return prisma.userSettings.create({
      data: {
        id: "singleton",
        defaultTlds: JSON.stringify([".com", ".ai", ".si"]),
        requestBudgetPerRun: 200,
        maxConcurrency: 2,
        requestDelayMs: 1000,
        fxRateSource: "manual",
        theme: "dark",
      },
    });
  },

  async update(input: UserSettingsInput) {
    const data = {
      defaultTlds: JSON.stringify(input.defaultTlds),
      requestBudgetPerRun: input.requestBudgetPerRun,
      maxConcurrency: input.maxConcurrency,
      requestDelayMs: input.requestDelayMs,
      fxRateSource: input.fxRateSource,
      theme: input.theme,
      investorNotes: input.investorNotes ?? null,
    };
    return prisma.userSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });
  },
};
