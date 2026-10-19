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
    <div className="space-y-6">
      <section className="deck">
        <div className="deck-pad">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-12">
            <div className="min-w-0 flex-1">
              <span className="pill-eyebrow">
                <Icon name="spark" size={13} />
                Live RDAP · no signup · nothing invented
              </span>
              <h1 className="display mt-4">
                Check a name against{" "}
                <em>every registry</em> that answers.
              </h1>
              <p className="lede mt-3.5 max-w-[52ch]">
                Enter a name. Domain Radar queries the RDAP endpoints we hold a
                verified record for, reports each registry state, and keeps the
                raw evidence behind every answer.
              </p>

              <div className="mt-6">
                <InvestigateLauncher />
              </div>
            </div>

            <div className="hidden w-[240px] shrink-0 self-stretch lg:block">
              <div className="rounded-[var(--r-lg)] border border-[var(--color-deck-line)] bg-[color-mix(in_srgb,var(--color-deck-ink)_5%,transparent)] p-4">
                <div className="eyebrow mb-3">How a lookup runs</div>
                <ol className="space-y-3">
                  {[
                    ["01", "Normalize the label"],
                    ["02", "Query each extension over RDAP"],
                    ["03", "Record registry state + provenance"],
                    ["04", "Flag what could not be resolved"],
                  ].map(([n, t]) => (
                    <li key={n} className="flex gap-3">
                      <span className="mono mt-[1px] text-[11px] text-[var(--color-accent-3)]">
                        {n}
                      </span>
                      <span className="text-[12.5px] leading-snug text-[var(--color-deck-ink-2)]">
                        {t}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="micro mt-4 border-t border-[var(--color-deck-line)] pt-3">
                  Unverified lookups are never reported as available.
                </p>
              </div>
            </div>
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
    <div className="space-y-5">
      <div className="skeleton h-[64px]" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="skeleton h-64 lg:col-span-2" />
        <div className="skeleton h-64" />
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
    <div className="space-y-5">
      <div>
        <StatLine
          items={[
            { label: "Candidates staged", value: candCounts.total },
            { label: "Registry checks run", value: totalChecks },
            { label: "Extensions live", value: availableTlds, tone: "accent" },
            {
              label: "Sources operational",
              value: `${operationalSources}/${sources.length}`,
            },
          ]}
        />
        <p className="micro mt-2.5">
          {lastCheck
            ? `Latest registry check ${formatWhen(lastCheck.checkedAt)} · `
            : "No registry checks recorded yet · "}
          {unsupportedTlds} extensions are explicitly unsupported and never
          scanned.
        </p>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Panel
            title="Recent investigations"
            note="RDAP sessions recorded on this instance, newest first"
            icon="clock"
            actions={
              <Link href="/scanner" className="btn btn-quiet btn-sm">
                New lookup
              </Link>
            }
          >
            {recentSessions.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <Icon name="investigate" size={21} />
                </div>
                <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                  No investigations recorded
                </p>
                <p className="mt-1.5 max-w-[42ch] text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
                  Run a live lookup above and it will appear here with its full
                  evidence trail.
                </p>
              </div>
            ) : (
              <ul>
                {recentSessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/scanner?name=${encodeURIComponent(s.normalizedSld)}`}
                      className="group flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 transition-colors last:border-0 hover:bg-[var(--color-surface-2)]"
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
                      <span className="dd min-w-0 flex-1 truncate">
                        {s.normalizedSld}
                      </span>
                      <span className="micro hidden whitespace-nowrap tabular-nums md:inline">
                        <span className="text-[var(--color-ink-2)]">
                          {s.registeredCount}
                        </span>{" "}
                        registered
                        <span className="mx-1.5 text-[var(--color-line-3)]">·</span>
                        <span className="text-[var(--color-ink-2)]">
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
                      <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-[var(--color-ink-3)] sm:inline">
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
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel
            title="Registry states"
            note="Normalized across every check"
            icon="registry"
            flush={false}
          >
            {statusRows.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-3)]">
                No registry checks recorded yet.
              </p>
            ) : (
              <ul className="space-y-3.5">
                {statusRows.map((row) => (
                  <li key={row.status}>
                    <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
                      <span className="text-[var(--color-ink-2)]">
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      <span className="mono font-medium text-[var(--color-ink)]">
                        {row.count}
                      </span>
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
              * “No record” means RDAP returned nothing for that name — it is not
              proof the domain is available to register.
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
              <div className="px-5 py-6 text-[13px] text-[var(--color-ink-3)]">
                No candidates stored yet.
              </div>
            ) : (
              <div className="grid-wrap">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Extension</th>
                      <th className="num">Candidates</th>
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
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
