import { NextResponse } from "next/server";
import { settingsRepository } from "@/lib/repository";
import { planFromCsv, planFromPaste, DEFAULT_PLAN_LIMITS } from "@/lib/jobs/spec";
import { jobRepository } from "@/lib/jobs/repository";
import { CsvError } from "@/lib/csv";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Bulk research jobs. A job is DURABLE (persisted) and advanced by the client
// calling POST /api/jobs/[id]/step. This route only creates/lists jobs.

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB paste/upload cap

export async function GET() {
  const jobs = await jobRepository.list(30);
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const limit = rateLimit(request, "jobsCreate");
  if (!limit.allowed) return tooManyRequests(limit);

  let text: string;
  let sourceLabel: string | null = "paste";
  let requestedTlds: string[] | null = null;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const rawText = form.get("text");
      if (file instanceof File) {
        if (file.size > MAX_BYTES) {
          return NextResponse.json(
            { error: "File exceeds 5 MB limit" },
            { status: 413 },
          );
        }
        text = await file.text();
        sourceLabel = file.name;
      } else if (typeof rawText === "string") {
        text = rawText;
      } else {
        return NextResponse.json(
          { error: "Provide a file or text." },
          { status: 400 },
        );
      }
      const tldsJson = form.get("tlds");
      if (typeof tldsJson === "string" && tldsJson.trim()) {
        requestedTlds = parseTlds(tldsJson);
      }
    } else {
      let body: { text?: unknown; tlds?: unknown; sourceLabel?: unknown };
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (typeof body.text !== "string" || !body.text.trim()) {
        return NextResponse.json(
          { error: "Provide non-empty 'text' to scan." },
          { status: 422 },
        );
      }
      text = body.text;
      if (typeof body.sourceLabel === "string") sourceLabel = body.sourceLabel;
      if (Array.isArray(body.tlds)) {
        requestedTlds = parseTlds(body.tlds);
      }
    }
  } catch {
    return NextResponse.json({ error: "Unreadable request body" }, { status: 400 });
  }

  if (text.length > MAX_BYTES) {
    return NextResponse.json({ error: "Payload exceeds 5 MB limit" }, { status: 413 });
  }

  const settings = await settingsRepository.get();
  const tlds =
    requestedTlds && requestedTlds.length > 0
      ? requestedTlds
      : safeParseList(settings.defaultTlds);

  if (tlds.length === 0) {
    return NextResponse.json(
      { error: "No extensions selected and no defaults configured." },
      { status: 422 },
    );
  }

  const limits = { ...DEFAULT_PLAN_LIMITS, maxItems: Math.min(DEFAULT_PLAN_LIMITS.maxItems, 5000) };

  let plan;
  try {
    const looksLikeCsv =
      sourceLabel !== "paste" || /\bdomain\b/i.test(text.split(/\r?\n/)[0] ?? "");
    plan = looksLikeCsv
      ? planFromCsv(text, tlds, limits)
      : planFromPaste(text, tlds, limits);
  } catch (err) {
    if (err instanceof CsvError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read input" },
      { status: 422 },
    );
  }

  if (plan.items.length === 0) {
    return NextResponse.json(
      {
        error: "No valid domains found in the input.",
        rejected: plan.rejected.slice(0, 50),
      },
      { status: 422 },
    );
  }

  const job = await jobRepository.create({
    rawInput: text,
    sourceLabel,
    requestedTlds: Array.from(new Set(plan.items.map((i) => i.tld))),
    items: plan.items,
    maxItems: limits.maxItems,
    maxTlds: limits.maxTlds,
  });

  const counts = await jobRepository.recount(job.id);
  return NextResponse.json(
    {
      job: { id: job.id, ...counts },
      rejected: plan.rejected.slice(0, 200),
      rejectedTotal: plan.rejected.length,
      overflow: plan.overflow,
    },
    { status: 201 },
  );
}

function parseTlds(input: string | unknown[]): string[] {
  const arr = Array.isArray(input) ? input : safeJsonArray(input);
  return Array.from(
    new Set(
      arr
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .map((t) => (t.startsWith(".") ? t : `.${t}`)),
    ),
  ).slice(0, 60);
}

function safeJsonArray(json: string): unknown[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function safeParseList(json: string): string[] {
  return safeJsonArray(json).filter((v): v is string => typeof v === "string");
}
