import Link from "next/link";
import { Suspense } from "react";
import { candidateRepository } from "@/lib/candidate-repository";
import { tldRepository } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard, EmptyCard } from "@/components/page-shell";
import { TldStatus, SourceStatus } from "@/lib/enums";

export default function OverviewPage() {
  return (
    <div>
      <PageHeader
        title="Overview"
        description="Evidence-first domain investment research. Every number below is read from the local database — nothing is simulated."
        actions={
          <Link
            href="/scanner"
            className="text-sm px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white font-medium"
          >
            Open Scanner
          </Link>
        }
      />
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewData />
      </Suspense>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] h-[92px] animate-pulse"
        />
      ))}
    </div>
  );
}

async function OverviewData() {
  const [candCounts, tldCounts, sources] = await Promise.all([
    candidateRepository.counts(),
    tldRepository.countByStatus(),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
  ]);

  const availableTlds =
    tldCounts.find((t) => t.status === TldStatus.AVAILABLE)?.count ?? 0;
  const unsupportedTlds =
    tldCounts.find((t) => t.status === TldStatus.UNSUPPORTED)?.count ?? 0;
  const operationalSources = sources.filter(
    (s) => s.status === SourceStatus.AVAILABLE,
  ).length;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Candidates" value={candCounts.total} hint="in local database" />
        <StatCard
          label="TLDs available"
          value={availableTlds}
          hint={`${unsupportedTlds} explicitly unsupported`}
        />
        <StatCard
          label="Sources operational"
          value={`${operationalSources}/${sources.length}`}
          hint="AVAILABLE in source registry"
        />
        <StatCard
          label="Availability checks"
          value={0}
          hint="RDAP adapter lands in Milestone 2"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold mb-3">Candidates by extension</h2>
          {candCounts.byTld.length === 0 ? (
            <EmptyCard
              title="No candidates yet"
              hint="Import a CSV or add candidates to get started."
            />
          ) : (
            <table className="w-full text-sm border border-[var(--color-border)] rounded-lg overflow-hidden">
              <thead className="bg-[var(--color-surface-2)] text-[var(--color-muted)] text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Extension</th>
                  <th className="text-right px-3 py-2 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {candCounts.byTld.map((row) => (
                  <tr key={row.tld} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-mono">{row.tld}</td>
                    <td className="px-3 py-2 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">Load-bearing sources</h2>
          <ul className="space-y-2">
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
              >
                <span>{s.name}</span>
                <span className="text-xs text-[var(--color-muted)]">{s.status}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/sources"
            className="inline-block mt-3 text-sm text-[var(--color-accent)]"
          >
            View source registry →
          </Link>
        </section>
      </div>
    </>
  );
}
