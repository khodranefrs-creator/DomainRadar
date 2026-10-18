import { z } from "zod";
import { normalizeTld } from "./domain";

// Zod schemas shared by API routes and import jobs. All external input is
// validated here before it touches the database.

export const tldStatusSchema = z.enum([
  "AVAILABLE",
  "UNSUPPORTED",
  "NEEDS_VERIFICATION",
  "DISABLED",
]);

export const candidateStatusSchema = z.enum([
  "CANDIDATE",
  "SHORTLISTED",
  "REJECTED",
  "ARCHIVED",
]);

export const userSettingsSchema = z.object({
  defaultTlds: z
    .array(z.string())
    .min(1, "At least one default TLD is required")
    .max(50)
    .transform((arr) => {
      const cleaned = arr
        .map((t) => normalizeTld(t))
        .filter((t): t is string => t !== null);
      return Array.from(new Set(cleaned));
    }),
  requestBudgetPerRun: z.coerce.number().int().min(1).max(10_000),
  maxConcurrency: z.coerce.number().int().min(1).max(10),
  requestDelayMs: z.coerce.number().int().min(0).max(60_000),
  fxRateSource: z.string().min(1).max(64),
  theme: z.enum(["dark", "light"]),
  investorNotes: z.string().max(4000).optional().nullable(),
});
export type UserSettingsInput = z.infer<typeof userSettingsSchema>;

export const candidateCreateSchema = z.object({
  domain: z.string().min(3).max(255),
  status: candidateStatusSchema.default("CANDIDATE"),
  generationRule: z.string().max(200).optional().nullable(),
  seedTerms: z.array(z.string().max(100)).max(100).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});
export type CandidateCreateInput = z.infer<typeof candidateCreateSchema>;

export const CANDIDATE_CSV_COLUMNS = [
  "domain",
  "status",
  "generation_rule",
  "seed_terms",
  "notes",
] as const;

export const candidateImportRowSchema = z.object({
  domain: z.string().min(3).max(255),
  status: candidateStatusSchema.optional(),
  generation_rule: z.string().max(200).optional(),
  seed_terms: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
});
export type CandidateImportRow = z.infer<typeof candidateImportRowSchema>;

export const SOURCE_CSV_COLUMNS = ["key", "name", "kind", "status", "terms_url", "notes"] as const;
