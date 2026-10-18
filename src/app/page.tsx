import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { candidateRepository } from "@/lib/candidate-repository";
import { tldRepository } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { Badge, availabilityTone } from "@/components/badge";
import { Icon } from "@/components/icons";
import { Bar, Note, Panel, StatLine } from "@/components/ui";
import { InvestigateLauncher } from "@/components/investigate-launcher";
import { TldStatus, SourceStatus } from "@/lib/enums";

export const metadata: Metadata = {
  title: "Console",
};

export default function ConsolePage() {
  return (
    <div>
      <section className="pt-2">
        <div className="eyebrow mb-3.5">Domain intelligence desk</div>
        <h1 className="display">
          What is this domain, <em>really</em>?
        </h1>
        <p className="lede mt-4">
          Type a name. Domain Radar checks it against every registry we hold a
          verified endpoint for, and shows the evidence behind the answer —
          including what it cannot prove.
        </p>
        <div className="mt-7">
          <InvestigateLauncher />
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
    <div className="mt-9 space-y-6">
      <div className="skeleton h-[54px]" />
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
    <div className="mt-8 space-y-6">
      <StatLine
        items={[
          { label: "Candidates staged", value: candCounts.total },
          { label: "Registry checks", value: totalChecks },
          { label: "Extensions live", value: availableTlds, tone: "accent" },
          { label: "Sources operational", value: `${operationalSources}/${sources.length}` },
        ]}
      />
      <p className="micro -mt-3">
        {lastCheck
          ? `Latest registry check ${formatWhen(lastCheck.checkedAt)} · `
          : "No registry checks recorded yet · "}
        {unsupportedTlds} extensions are explicitly unsupported and never scanned.
      </p>

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <section className="panel-flush">
            <div className="panel-head">
              <div className="min-w-0">
                <h2 className="panel-title">
                  <Icon name="clock" size={15} />
                  Recent investigations
                </h2>
                <p className="panel-note">
                  RDAP lookups recorded on this instance, newest first
                </p>
              </div>
              <Link href="/scanner" className="btn btn-ghost btn-sm">
                New lookup
              </Link>
            </div>

            {recentSessions.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <Icon name="investigate" size={20} />
                </div>
                <p className="text-[13.5px] font-medium text-[var(--color-ink)]">
                  No investigations recorded
                </p>
                <p className="max-w-sm text-[12px] leading-relaxed text-[var(--color-ink-3)]">
                  Run a live lookup above and it will appear here with its
                  evidence trail.
                </p>
              </div>
            ) : (
              <ul>
                {recentSessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/scanner?name=${encodeURIComponent(s.normalizedSld)}`}
                      className="group flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 transition-colors last:border-0 hover:bg-[var(--color-bg-2)]"
                    >
                      <span
                        className="dot shrink-0"
                        style={{
                          background:
                            s.status === "COMPLETED"
                              ? "var(--color-ok)"
                              : s.status === "FAILED"
                                ? "var(--color-bad)"
                                : "var(--color-warn)",
                        }}
                        aria-hidden
                      />
                      <span className="mono min-w-0 flex-1 truncate text-[13.5px] text-[var(--color-ink)]">
                        {s.normalizedSld}
                      </span>
                      <span className="micro hidden whitespace-nowrap md:inline">
                        <span className="tnum text-[var(--color-ink-2)]">
                          {s.registeredCount}
                        </span>{" "}
                        registered
                        <span className="mx-1.5 text-[var(--color-ink-4)]">·</span>
                        <span className="tnum text-[var(--color-ink-2)]">
                          {s.checkedCount}
                        </span>{" "}
                        checked
                      </span>
                      <Badge
                        dot
                        tone={
                          s.status === "COMPLETED"
                            ? "good"
                            : s.status === "FAILED"
                              ? "bad"
                              : "warn"
                        }
                      >
                        {s.status === "COMPLETED" ? "complete" : s.status.toLowerCase()}
                      </Badge>
                      <span className="faint whitespace-nowrap text-[11px]">
                        {formatWhen(s.completedAt ?? s.startedAt)}
                      </span>
                      <Icon
                        name="chevron"
                        size={15}
                        className="shrink-0 text-[var(--color-ink-4)] transition-colors group-hover:text-[var(--color-ink-2)]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
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
              * &ldquo;No record&rdquo; means RDAP returned nothing for that name — it is
              not proof the domain is available to register.
            </Note>
          </Panel>

          <Panel
            title="Candidates by extension"
            icon="pipeline"
            actions={
              <Link href="/candidates" className="btn btn-quiet btn-sm">
                Manage
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
                        <td className="mono primary">.{row.tld}</td>
                        <td className="num">{row.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
