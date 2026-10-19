import { NextResponse } from "next/server";
import { jobRepository } from "@/lib/jobs/repository";

// Read a durable job and page through its items.

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "200");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const job = await jobRepository.get(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { items, total } = await jobRepository.items(id, {
    status,
    limit: Number.isFinite(limit) ? limit : 200,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json({
    job: {
      id: job.id,
      kind: job.kind,
      status: job.status,
      sourceLabel: job.sourceLabel,
      requestedTlds: safeParse(job.requestedTlds),
      totalItems: job.totalItems,
      pendingCount: job.pendingCount,
      runningCount: job.runningCount,
      doneCount: job.doneCount,
      failedCount: job.failedCount,
      skippedCount: job.skippedCount,
      lastError: job.lastError,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
    items: items.map((it) => ({
      id: it.id,
      sld: it.sld,
      tld: it.tld,
      fqdn: it.fqdn,
      status: it.status,
      attempts: it.attempts,
      normalizedStatus: it.normalizedStatus,
      httpStatus: it.httpStatus,
      providerHost: it.providerHost,
      requestUrl: it.requestUrl,
      errorKind: it.errorKind,
      errorDetails: it.errorDetails,
      responseMs: it.responseMs,
      isFresh: it.isFresh,
      checkedAt: it.checkedAt,
    })),
    total,
  });
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
