import { NextResponse } from "next/server";
import { jobRepository } from "@/lib/jobs/repository";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Cancel a durable job: PENDING items become SKIPPED, RUNNING items are returned
// to PENDING (so a later explicit retry could pick them up), and the job is
// marked CANCELLED. Cancellation is honoured between steps, never mid-request.

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

  const counts = await jobRepository.cancel(id);
  return NextResponse.json({ jobId: id, status: "CANCELLED", counts });
}
