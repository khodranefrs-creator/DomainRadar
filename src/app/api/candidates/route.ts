import { NextResponse } from "next/server";
import { candidateRepository } from "@/lib/candidate-repository";
import { parseDomain } from "@/lib/domain";
import { candidateCreateSchema } from "@/lib/schemas";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";


export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await candidateRepository.list({
    tld: url.searchParams.get("tld") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    limit: url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined,
    offset: url.searchParams.get("offset")
      ? Number(url.searchParams.get("offset"))
      : undefined,
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const limit = rateLimit(request, "candidatesWrite");
  if (!limit.allowed) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = candidateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const dom = parseDomain(parsed.data.domain);
  if (!dom) {
    return NextResponse.json(
      { error: `Invalid domain: ${parsed.data.domain}` },
      { status: 422 },
    );
  }
  const created = await candidateRepository.upsert({
    fqdn: dom.fqdn,
    sld: dom.sld,
    tld: dom.tld,
    status: parsed.data.status,
    generationRule: parsed.data.generationRule ?? null,
    seedTerms: parsed.data.seedTerms ?? null,
    notes: parsed.data.notes ?? null,
  });
  return NextResponse.json({ candidate: created }, { status: 201 });
}
