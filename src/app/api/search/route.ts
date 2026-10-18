import { NextResponse } from "next/server";
import { settingsRepository } from "@/lib/repository";
import { normalizeSld } from "@/lib/domain";
import { runSearch, createDefaultSearchDeps } from "@/lib/rdap";

// Multi-TLD search with live RDAP availability checks. Server-side only: the
// client never supplies lookup URLs, and every request goes through the SSRF
// allowlist inside the RDAP client. A 404 is reported as NOT_FOUND (registry
// state), never as "available".

export async function POST(request: Request) {
  let body: { name?: string; tlds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sld = normalizeSld(typeof body.name === "string" ? body.name : "");
  if (!sld) {
    return NextResponse.json(
      { error: "Provide a valid name (letters, digits, hyphens)." },
      { status: 422 },
    );
  }

  const settings = await settingsRepository.get();

  let requested: string[];
  if (Array.isArray(body.tlds) && body.tlds.length > 0) {
    requested = Array.from(
      new Set(
        body.tlds
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().toLowerCase())
          .map((t) => (t.startsWith(".") ? t : `.${t}`)),
      ),
    ).slice(0, 60);
  } else {
    requested = safeParseList(settings.defaultTlds);
  }

  if (requested.length === 0) {
    return NextResponse.json(
      { error: "No TLDs selected and no defaults configured." },
      { status: 422 },
    );
  }

  const deps = createDefaultSearchDeps({
    defaultMinIntervalMs: Math.max(250, settings.requestDelayMs),
    maxConcurrency: settings.maxConcurrency,
  });

  let summary;
  try {
    summary = await runSearch(
      {
        rawQuery: typeof body.name === "string" ? body.name : sld,
        sld,
        requestedTlds: requested,
      },
      deps,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Search failed: ${err.message}`
            : "Search failed unexpectedly.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(summary);
}

function safeParseList(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
