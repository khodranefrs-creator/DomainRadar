import { prisma } from "./db";
import { parseDomain } from "./domain";
import { tldRepository } from "./repository";
import { candidateImportRowSchema } from "./schemas";
import { parseCsv, toCsv, CsvError } from "./csv";

// Candidate repository + CSV import/export. Every imported row is validated and
// linked to a TldRegistry row; unknown extensions are auto-registered as
// NEEDS_VERIFICATION rather than silently dropped.

export interface ImportError {
  row: number;
  reason: string;
}

export interface ImportResult {
  importJobId: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorRows: number;
  errors: ImportError[];
}

function seedTermsToCsv(json: string | null): string {
  if (!json) return "";
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr)
      ? arr.filter((v): v is string => typeof v === "string").join("|")
      : "";
  } catch {
    return "";
  }
}

export const candidateRepository = {
  async list(
    options: {
      tld?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const where: Record<string, unknown> = {};
    if (options.tld) where.tld = options.tld;
    if (options.status) where.status = options.status;
    if (options.search) where.fqdn = { contains: options.search.toLowerCase() };
    const take = Math.min(options.limit ?? 100, 500);
    const [items, total] = await Promise.all([
      prisma.domainCandidate.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take,
        skip: options.offset ?? 0,
      }),
      prisma.domainCandidate.count({ where }),
    ]);
    return { items, total };
  },

  async counts() {
    const [total, byStatus, byTld] = await Promise.all([
      prisma.domainCandidate.count(),
      prisma.domainCandidate.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.domainCandidate.groupBy({ by: ["tld"], _count: { _all: true } }),
    ]);
    return {
      total,
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      byTld: byTld.map((r) => ({ tld: r.tld, count: r._count._all })),
    };
  },

  async upsert(input: {
    fqdn: string;
    sld: string;
    tld: string;
    status?: string;
    generationRule?: string | null;
    seedTerms?: string[] | null;
    notes?: string | null;
  }) {
    const tldRow = await tldRepository.ensure(input.tld);
    return prisma.domainCandidate.upsert({
      where: { fqdn: input.fqdn },
      create: {
        fqdn: input.fqdn,
        sld: input.sld,
        tld: input.tld,
        tldId: tldRow.id,
        status: input.status ?? "CANDIDATE",
        generationRule: input.generationRule ?? null,
        seedTerms: input.seedTerms ? JSON.stringify(input.seedTerms) : null,
        notes: input.notes ?? null,
      },
      update: {
        status: input.status ?? undefined,
        generationRule: input.generationRule ?? undefined,
        notes: input.notes ?? undefined,
      },
    });
  },

  async exportCsv(): Promise<string> {
    const rows = await prisma.domainCandidate.findMany({
      orderBy: { fqdn: "asc" },
    });
    return toCsv(
      [
        { key: "domain", header: "domain" },
        { key: "status", header: "status" },
        { key: "generation_rule", header: "generation_rule" },
        { key: "seed_terms", header: "seed_terms" },
        { key: "notes", header: "notes" },
        { key: "created_at", header: "created_at" },
        { key: "updated_at", header: "updated_at" },
      ],
      rows.map((r) => ({
        domain: r.fqdn,
        status: r.status,
        generation_rule: r.generationRule ?? "",
        seed_terms: seedTermsToCsv(r.seedTerms),
        notes: r.notes ?? "",
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      })),
    );
  },

  async importCsv(text: string, filename?: string): Promise<ImportResult> {
    const job = await prisma.importJob.create({
      data: { kind: "CANDIDATES_CSV", filename: filename ?? null, status: "RUNNING" },
    });

    const fail = async (reason: string): Promise<never> => {
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errors: JSON.stringify([{ row: 0, reason }]),
          errorRows: 1,
        },
      });
      throw new CsvError(reason);
    };

    let parsed;
    try {
      parsed = parseCsv(text, { maxRows: 100_000 });
    } catch (err) {
      return await fail(
        err instanceof CsvError ? err.message : "Unparseable CSV",
      );
    }

    if (!parsed.headers.includes("domain")) {
      return await fail("Missing required column: domain");
    }

    const errors: ImportError[] = [];
    let importedRows = 0;

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rowNumber = i + 2; // header is row 1
      const validated = candidateImportRowSchema.safeParse(row);
      if (!validated.success) {
        errors.push({
          row: rowNumber,
          reason: validated.error.issues.map((e) => e.message).join("; "),
        });
        continue;
      }
      const parsedDomain = parseDomain(validated.data.domain);
      if (!parsedDomain) {
        errors.push({ row: rowNumber, reason: `Invalid domain: ${row.domain}` });
        continue;
      }
      const seedTerms = validated.data.seed_terms
        ? validated.data.seed_terms
            .split(/[|,]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 100)
        : null;
      try {
        await candidateRepository.upsert({
          fqdn: parsedDomain.fqdn,
          sld: parsedDomain.sld,
          tld: parsedDomain.tld,
          status: validated.data.status,
          generationRule: validated.data.generation_rule ?? null,
          seedTerms,
          notes: validated.data.notes ?? null,
        });
        importedRows++;
      } catch (err) {
        errors.push({
          row: rowNumber,
          reason: err instanceof Error ? err.message : "Database error",
        });
      }
    }

    const result: ImportResult = {
      importJobId: "",
      totalRows: parsed.rows.length,
      importedRows,
      skippedRows: parsed.skippedRows,
      errorRows: errors.length,
      errors: errors.slice(0, 500),
    };

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: errors.length === parsed.rows.length && parsed.rows.length > 0 ? "FAILED" : "COMPLETED",
        finishedAt: new Date(),
        totalRows: parsed.rows.length,
        importedRows,
        skippedRows: parsed.skippedRows,
        errorRows: errors.length,
        errors: errors.length ? JSON.stringify(errors.slice(0, 500)) : null,
      },
    });

    return { ...result, importJobId: job.id };
  },
};
