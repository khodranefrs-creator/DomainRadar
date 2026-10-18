import Link from "next/link";
import { Suspense } from "react";
import { candidateRepository } from "@/lib/candidate-repository";
import { tldRepository } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { Badge, availabilityTone } from "@/components/badge";
import { Bar, Empty, Note, Panel } from "@/components/ui";
import { InvestigateLauncher } from "@/components/investigate-launcher";
import { TldStatus, SourceStatus } from "@/lib/enums";

export default function ConsolePage() {
  return (
    <div>
      <section className="hero-panel mb-8 px-6 py-9 sm:px-9 sm:py-11">
        <div className="relative z-10 max-w-[62ch]">
          <div className="eyebrow mb-3">Domain intelligence terminal</div>
          <h1 className="display">
            Trace what a domain
            <br className="hidden sm:block" /> actually is.
          </h1>
          <p className="lede mt-4">
            Live RDAP lookups across every verified extension, a local candidate
            pipeline, and an evidence trail behind every row. An unverified lookup
            is never presented as an available domain.
          </p>
          <div className="mt-7 max-w-2xl">
            <InvestigateLauncher />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href="/candidates" className="btn btn-ghost btn-sm">
              Candidate pipeline
            </Link>
            <Link href="/sources" className="btn btn-ghost btn-sm">
              Registry &amp; sources
            </Link>
            <span className="hidden items-center gap-2 text-[11.5px] text-[var(--color-ink-3)] sm:flex">
              <span className="kbd">⌘K</span> command menu
            </span>
          </div>
        </div>
      </section>

      <Suspense fallback={<ConsoleSkeleton />}>
        <ConsoleData />
      </Suspense>
    </div>
  );
}

function ConsoleSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-[92px]" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="skeleton h-72 lg:col-span-3" />
        <div className="skeleton h-72 lg:col-span-2" />
      </div>
    </div>
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

async function ConsoleData() {
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

  return (
    <>
      <div className="panel mb-6 overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-[var(--color-line)] lg:grid-cols-4">
          <Signal label="Candidates staged" value={candCounts.total} hint="in the local pipeline" />
          <Signal
            label="Registry checks"
            value={totalChecks}
            hint={lastCheck ? `latest ${formatWhen(lastCheck.checkedAt)}` : "none recorded"}
          />
          <Signal
            label="Extensions live"
            value={availableTlds}
            hint={`${unsupportedTlds} explicitly unsupported`}
          />
          <Signal
            label="Operational sources"
            value={`${operationalSources}/${sources.length}`}
            hint="status: available"
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <Panel
            flush
            icon="clock"
            title="Recent investigations"
            note="Latest RDAP lookups recorded on this instance"
            actions={
              <Link href="/scanner" className="btn btn-ghost btn-sm">
                New lookup
              </Link>
            }
          >
            {recentSessions.length === 0 ? (
              <Empty
                icon="investigate"
                title="No investigations recorded"
                hint="Run a live RDAP lookup and it will appear here with its evidence."
                action={
                  <Link href="/scanner" className="btn btn-primary btn-sm">
                    Open Investigate
                  </Link>
                }
              />
            ) : (
              <div className="grid-wrap">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Coverage</th>
                      <th className="num">Registered</th>
                      <th className="num">No record</th>
                      <th>Status</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSessions.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link
                            href={`/scanner?name=${encodeURIComponent(s.normalizedSld)}`}
                            className="primary mono"
                          >
                            {s.normalizedSld}
                          </Link>
                        </td>
                        <td className="num">
                          {s.checkedCount}/{s.requestedCount}
                        </td>
                        <td className="num">{s.registeredCount}</td>
                        <td className="num">{s.notFoundCount}</td>
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
                        <td className="faint">
                          {formatWhen(s.completedAt ?? s.startedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel
            title="Availability mix"
            note="Normalized status across every registry check"
            icon="registry"
            flush={false}
          >
            {statusRows.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-ink-3)]">
                No registry checks recorded yet.
              </p>
            ) : (
              <ul className="space-y-3.5">
                {statusRows.map((row) => (
                  <li key={row.status}>
                    <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                      <span className="text-[var(--color-ink-2)]">
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      <span className="mono text-[var(--color-ink)]">{row.count}</span>
                    </div>
                    <Bar
                      value={row.count}
                      max={maxStatus}
                      tone={availabilityTone(row.status)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <Note>
              * &ldquo;No record&rdquo; means RDAP returned nothing for that name —
              it is not proof the domain is available to register.
            </Note>
          </Panel>

          <Panel
            title="Candidates by extension"
            icon="pipeline"
            actions={
              <Link href="/candidates" className="link text-[11.5px]">
                Manage →
              </Link>
            }
          >
            {candCounts.byTld.length === 0 ? (
              <div className="px-5 py-6 text-[12.5px] text-[var(--color-ink-3)]">
                No candidates stored yet.
              </div>
            ) : (
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Extension</th>
                    <th className="num">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {candCounts.byTld
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .map((row) => (
                      <tr key={row.tld}>
                        <td className="mono">{row.tld}</td>
                        <td className="num">{row.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-6">
        <Note>
          Every figure on this page is read from the local database or a live
          registry lookup — nothing is simulated, sampled or invented. Coverage is
          limited to extensions with a verified RDAP endpoint.
        </Note>
      </div>
    </>
  );
}

function Signal({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-[var(--color-panel)] px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="stat-lg mt-2.5">{value}</div>
      {hint ? (
        <div className="mt-1.5 text-[11.5px] text-[var(--color-ink-3)]">{hint}</div>
      ) : null}
    </div>
  );
}
