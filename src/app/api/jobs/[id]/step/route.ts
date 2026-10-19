import { NextResponse } from "next/server";
import { runJobStep } from "@/lib/jobs/engine";
import { jobRepository } from "@/lib/jobs/repository";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ResearchJobStatus } from "@/lib/enums";

// Advance a durable job by one bounded step. The client drives this repeatedly
// until `hasMore` is false. Concurrency-safe: an overlapping call simply gets
// `skippedClaim: true` because the job lease is held elsewhere.

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const limit = rateLimit(request, "jobsStep");
  if (!limit.allowed) return tooManyRequests(limit);

  const { id } = await ctx.params;
  const job = await jobRepository.get(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (
    job.status === ResearchJobStatus.CANCELLED ||
    job.status === ResearchJobStatus.COMPLETED ||
    job.status === ResearchJobStatus.FAILED
  ) {
    return NextResponse.json({
      jobId: id,
      status: job.status,
      processed: 0,
      hasMore: false,
      terminal: true,
    });
  }

  let maxItems = 40;
  try {
    const body = await request.json();
    if (typeof body?.maxItems === "number") {
      maxItems = Math.max(1, Math.min(body.maxItems, 200));
    }
  } catch {
    // No body is fine; use defaults.
  }

  const result = await runJobStep(id, { maxItems });
  return NextResponse.json(result);
}
