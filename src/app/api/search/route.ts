import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tldRepository, settingsRepository } from "@/lib/repository";
import { normalizeSld } from "@/lib/domain";
import { TldStatus } from "@/lib/enums";


// Enumerates the multi-TLD variants for a name and records a DomainSearchSession.
// IMPORTANT: this endpoint does NOT perform availability lookups yet. Live RDAP
// checking arrives in Milestone 2. Every variant is returned with an explicit
// status and NO last-checked time, so the UI never implies an unverified name is
// available.

interface VariantView {
  tld: string;
  fqdn: string;
  status:
    | "PENDING_CHECK"
    | "UNSUPPORTED"
    | "NEEDS_VERIFICATION"
    | "DISABLED"
    | "UNKNOWN_TLD";
  source: string | null;
  lastCheckedAt: string | null;
  detail: string;
}

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

  const variants: VariantView[] = [];
  let unsupportedCount = 0;
  let unresolvedCount = 0;

  for (const tld of requested) {
    const row = await tldRepository.getByTld(tld);
    const fqdn = `${sld}${tld}`;
    if (!row) {
      unresolvedCount++;
      variants.push({
        tld,
        fqdn,
        status: "UNKNOWN_TLD",
        source: null,
        lastCheckedAt: null,
        detail: "Extension not in registry - not yet configured.",
      });
      continue;
    }
    if (row.status === TldStatus.UNSUPPORTED) {
      unsupportedCount++;
      variants.push({
        tld,
        fqdn,
        status: "UNSUPPORTED",
        source: null,
        lastCheckedAt: null,
        detail: row.notes ?? "No verified RDAP endpoint available.",
      });
    } else if (row.status === TldStatus.DISABLED) {
      unresolvedCount++;
      variants.push({
        tld,
        fqdn,
        status: "DISABLED",
        source: null,
        lastCheckedAt: null,
        detail: "Disabled in the TLD registry.",
      });
    } else if (row.status === TldStatus.NEEDS_VERIFICATION) {
      unresolvedCount++;
      variants.push({
        tld,
        fqdn,
        status: "NEEDS_VERIFICATION",
        source: null,
        lastCheckedAt: null,
        detail: "RDAP capability not yet verified.",
      });
    } else {
      variants.push({
        tld,
        fqdn,
        status: "PENDING_CHECK",
        source: row.registryName,
        lastCheckedAt: null,
        detail: "Ready for a live check (arrives in Milestone 2).",
      });
    }
  }

  const session = await prisma.domainSearchSession.create({
    data: {
      rawQuery: typeof body.name === "string" ? body.name.slice(0, 255) : sld,
      normalizedSld: sld,
      requestedTlds: JSON.stringify(requested),
      requestedCount: requested.length,
      unsupportedCount,
      unresolvedCount,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    sld,
    requestedCount: requested.length,
    unsupportedCount,
    unresolvedCount,
    checkedCount: 0,
    variants,
    note: "Placeholder: no availability checks have been run yet (Milestone 2).",
  });
}

function safeParseList(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
