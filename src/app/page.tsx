import Link from "next/link";
import { Suspense } from "react";
import { candidateRepository } from "@/lib/candidate-repository";
import { tldRepository } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard, Section, EmptyCard } from "@/components/page-shell";
import { Badge, availabilityTone } from "@/components/badge";
import { TldStatus, SourceStatus } from "@/lib/enums";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Evidence-first domain investment research. Every figure is read from the database or a live registry lookup — nothing here is simulated."
        actions={
          <Link href="/scanner" className="btn btn-primary">
            Open Scanner
          </Link>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="panel h-[104px] animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="panel h-72 animate-pulse lg:col-span-3" />
        <div className="panel h-72 animate-pulse lg:col-span-2" />
      </div>
    </>
  );
}

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  NOT_FOUND: "No record*",
  RESERVED: "Reserved",
  RESTRICTED: "Restricted",
  RATE_LIMITED: "Rate limited",
  UNKNOWN: "Unknown",
  UNSUPPORTED: "Unsupported",
  ERROR: "Error",
};

const TONE_BAR: Record<string, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  bad: "bg-red-400",
  info: "bg-blue-400",
  neutral: "bg-zinc-400",
  unknown: "bg-zinc-500",
};

function formatWhen(date: Date | null): string {
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toISOString().slice(0, 10);
}

async function DashboardData() {
  const [
    candCounts,
    tldCounts,
    sources,
    statusGroups,
    totalChecks,
    recentSessions,
    lastCheck,
  ] = await Promise.all([
    candidateRepository.counts(),
    tldRepository.countByStatus(),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
    prisma.domainVariantCheck.groupBy({
      by: ["normalizedStatus"],
      _count: { _all: true },
    }),
    prisma.domainVariantCheck.count(),
    prisma.domainSearchSession.findMany({
      orderBy: { startedAt: "desc" },
      take: 6,
    }),
    prisma.domainVariantCheck.findFirst({
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
  ]);

  const availableTlds =
    tldCounts.find((t) => t.status === TldStatus.AVAILABLE)?.count ?? 0;
  const unsupportedTlds =
    tldCounts.find((t) => t.status === TldStatus.UNSUPPORTED)?.count ?? 0;
  const operationalSources = sources.filter(
    (s) => s.status === SourceStatus.AVAILABLE,
  ).length;

  const statusRows = statusGroups
    .map((g) => ({ status: g.normalizedStatus, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
  const maxStatus = Math.max(1, ...statusRows.map((r) => r.count));

  const hasData = totalChecks > 0 || candCounts.total > 0;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Candidates"
          value={candCounts.total}
          hint="stored domains"
        />
        <StatCard
          label="Registry checks"
          value={totalChecks}
          hint={lastCheck ? `last ${formatWhen(lastCheck.checkedAt)}` : "none yet"}
          tone="info"
        />
        <StatCard
          label="Extensions online"
          value={availableTlds}
          hint={`${unsupportedTlds} explicitly unsupported`}
          tone="ok"
        />
        <StatCard
          label="Sources online"
          value={`${operationalSources}/${sources.length}`}
          hint="AVAILABLE in registry"
          tone="neutral"
        />
      </div>

      {!hasData ? (
        <EmptyCard
          title="No research data yet"
          hint="Run a live RDAP scan or import a CSV of candidates to populate the dashboard."
          action={
            <Link href="/scanner" className="btn btn-primary">
              Run your first scan
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Section
              title="Recent scans"
              description="One row per multi-extension lookup session."
              padded={false}
              actions={
                <Link href="/scanner" className="link text-xs">
                  New scan →
                </Link>
              }
            >
              {recentSessions.length === 0 ? (
                <div className="p-5">
                  <p className="text-sm text-[var(--color-muted)]">
                    No scan sessions recorded yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th className="text-right">Checked</th>
                        <th className="text-right">Registered</th>
                        <th className="text-right">No record</th>
                        <th>Status</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.map((s) => (
                        <tr key={s.id}>
                          <td className="mono font-medium text-[var(--color-fg)]">
                            {s.normalizedSld}
                          </td>
                          <td className="tnum text-right">
                            {s.checkedCount}/{s.requestedCount}
                          </td>
                          <td className="tnum text-right">{s.registeredCount}</td>
                          <td className="tnum text-right">{s.notFoundCount}</td>
                          <td>
                            <Badge
                              tone={
                                s.status === "COMPLETED"
                                  ? "good"
                                  : s.status === "FAILED"
                                    ? "bad"
                                    : "warn"
                              }
                              dot
                            >
                              {s.status}
                            </Badge>
                          </td>
                          <td className="text-[var(--color-muted)]">
                            {formatWhen(s.completedAt ?? s.startedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <Section
              title="Availability mix"
              description="Normalized status across every registry check."
            >
              {statusRows.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  No registry checks recorded yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {statusRows.map((row) => {
                    const tone = availabilityTone(row.status);
                    return (
                      <li key={row.status}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-[var(--color-muted)]">
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                          <span className="tnum text-[var(--color-fg)]">
                            {row.count}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                          <div
                            className={`h-full rounded-full ${TONE_BAR[tone]}`}
                            style={{
                              width: `${Math.max(4, (row.count / maxStatus) * 100)}%`,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-faint)]">
                * &ldquo;No record&rdquo; means RDAP returned nothing for that
                name — it is not proof the domain is available to register.
              </p>
            </Section>

            <Section
              title="Candidates by extension"
              padded={false}
              actions={
                <Link href="/candidates" className="link text-xs">
                  Manage →
                </Link>
              }
            >
              {candCounts.byTld.length === 0 ? (
                <div className="p-5">
                  <p className="text-sm text-[var(--color-muted)]">
                    No candidates stored yet.
                  </p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Extension</th>
                      <th className="text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candCounts.byTld
                      .slice()
                      .sort((a, b) => b.count - a.count)
                      .map((row) => (
                        <tr key={row.tld}>
                          <td className="mono">{row.tld}</td>
                          <td className="tnum text-right">{row.count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>
        </div>
      )}
    </>
  );
}
