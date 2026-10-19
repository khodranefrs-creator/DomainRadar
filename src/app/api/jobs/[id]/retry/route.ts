import { NextResponse } from "next/server";
import { jobRepository } from "@/lib/jobs/repository";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Requeue every FAILED item back to PENDING so the next steps retry them.
// Attempts are preserved so the UI can show how many times an item was tried.

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

  const requeued = await jobRepository.requeueFailed(id);
  const counts = await jobRepository.recount(id);
  await jobRepository.setStatus(id, "PAUSED", { finishedAt: null });

  return NextResponse.json({ jobId: id, requeued, counts });
}
