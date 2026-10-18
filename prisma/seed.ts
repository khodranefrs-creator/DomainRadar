import { PrismaClient } from "@prisma/client";
import { TLD_CATALOG } from "../src/lib/tld-catalog";
import { SOURCE_CATALOG } from "../src/lib/source-catalog";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding TLD registry...");
  let tldCreated = 0;
  let tldUpdated = 0;
  for (const seed of TLD_CATALOG) {
    const existing = await prisma.tldRegistry.findUnique({ where: { tld: seed.tld } });
    const data = {
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
    };
    if (existing) {
      await prisma.tldRegistry.update({ where: { tld: seed.tld }, data });
      tldUpdated++;
    } else {
      await prisma.tldRegistry.create({ data: { tld: seed.tld, ...data } });
      tldCreated++;
    }
  }
  console.log(`  TLDs: ${tldCreated} created, ${tldUpdated} updated`);

  console.log("Seeding source registry...");
  let srcCreated = 0;
  let srcUpdated = 0;
  for (const seed of SOURCE_CATALOG) {
    const data = {
      name: seed.name,
      kind: seed.kind,
      status: seed.status,
      termsUrl: seed.termsUrl,
      permittedUseNotes: seed.permittedUseNotes,
      attributionRequired: seed.attributionRequired,
      attributionText: seed.attributionText,
      requiresAuth: seed.requiresAuth,
      rateLimitPerMinute: seed.rateLimitPerMinute,
      cacheTtlSeconds: seed.cacheTtlSeconds,
      timeoutMs: seed.timeoutMs,
      maxRetries: seed.maxRetries,
    };
    const existing = await prisma.source.findUnique({ where: { key: seed.key } });
    if (existing) {
      await prisma.source.update({ where: { key: seed.key }, data });
      srcUpdated++;
    } else {
      await prisma.source.create({ data: { key: seed.key, ...data } });
      srcCreated++;
    }
  }
  console.log(`  Sources: ${srcCreated} created, ${srcUpdated} updated`);

  await prisma.userSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      defaultTlds: JSON.stringify([".com", ".ai", ".si"]),
      requestBudgetPerRun: 200,
      maxConcurrency: 2,
      requestDelayMs: 1000,
      fxRateSource: "manual",
      theme: "dark",
    },
    update: {},
  });
  console.log("  Settings: singleton ready");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
