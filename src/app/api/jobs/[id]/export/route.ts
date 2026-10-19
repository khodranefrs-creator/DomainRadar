import { jobRepository } from "@/lib/jobs/repository";
import { toCsv } from "@/lib/csv";

// Export a job's items as CSV (formula-injection safe). Includes the audit
// fields users need to verify a result: provider host, HTTP status, error kind.

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const job = await jobRepository.get(id);
  if (!job) {
    return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const items = await jobRepository.allItems(id);
  const csv = toCsv(
    [
      { key: "domain", header: "domain" },
      { key: "extension", header: "extension" },
      { key: "status", header: "status" },
      { key: "availability", header: "availability" },
      { key: "http_status", header: "http_status" },
      { key: "provider", header: "provider_host" },
      { key: "error_kind", header: "error_kind" },
      { key: "detail", header: "detail" },
      { key: "response_ms", header: "response_ms" },
      { key: "checked_at", header: "checked_at" },
      { key: "attempts", header: "attempts" },
    ],
    items.map((it) => ({
      domain: it.fqdn,
      extension: it.tld,
      status: it.status,
      availability: it.normalizedStatus ?? "",
      http_status: it.httpStatus ?? "",
      provider: it.providerHost ?? "",
      error_kind: it.errorKind ?? "",
      detail: it.errorDetails ?? "",
      response_ms: it.responseMs ?? "",
      checked_at: it.checkedAt ? it.checkedAt.toISOString() : "",
      attempts: it.attempts,
    })),
  );

  const filename = `job-${id.slice(0, 8)}-results.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
