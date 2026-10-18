import { candidateRepository } from "@/lib/candidate-repository";


export async function GET() {
  const csv = await candidateRepository.exportCsv();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="domain-radar-candidates-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
