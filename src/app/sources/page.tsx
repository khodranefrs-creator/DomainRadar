import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { tldRepository } from "@/lib/repository";
import { Badge } from "@/components/badge";
import { Note, Panel, PageHeader } from "@/components/ui";
import { SourceStatus, TldStatus } from "@/lib/enums";

export const metadata = {
  title: "Registry · Domain Radar",
};

export default function SourcesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Registry"
        title="Extensions & sources"
        lead="Exactly which extensions can be checked, and every external provider with its permitted-use notes and current status. A planned adapter is never shown as operational."
      />
      <Suspense fallback={<RegistrySkeleton />}>
        <RegistryData />
      </Suspense>
    </div>
  );
}

function RegistrySkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-[92px]" />
      <div className="skeleton h-72" />
      <div className="skeleton h-72" />
    </div>
  );
}

const TLD_TONE: Record<
  string,
  "neutral" | "good" | "warn" | "bad" | "info" | "unknown"
> = {
  AVAILABLE: "good",
  NEEDS_VERIFICATION: "warn",
  DISABLED: "bad",
  UNSUPPORTED: "unknown",
};

const SRC_TONE: Record<
  string,
  "neutral" | "good" | "warn" | "bad" | "info" | "unknown"
> = {
  AVAILABLE: "good",
  MANUAL_ONLY: "warn",
  DISABLED: "bad",
  RATE_LIMITED: "warn",
  NEEDS_CONFIGURATION: "warn",
};

async function RegistryData() {
  const [tlds, sources] = await Promise.all([
    tldRepository.list(),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
  ]);

  const verifiedTlds = tlds.filter((t) => t.status === TldStatus.AVAILABLE).length;
  const unsupportedTlds = tlds.filter(
    (t) => t.status === TldStatus.UNSUPPORTED,
  ).length;
  const operational = sources.filter(
    (s) => s.status === SourceStatus.AVAILABLE,
  ).length;

  return (
    <div className="space-y-6">
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-[var(--color-line)] lg:grid-cols-4">
          {[
            ["Extensions tracked", tlds.length],
            ["Verified endpoints", verifiedTlds],
            ["Explicitly unsupported", unsupportedTlds],
            ["Sources operational", `${operational}/${sources.length}`],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-[var(--color-panel)] px-5 py-4">
              <div className="eyebrow">{label}</div>
              <div className="mono mt-2.5 text-[24px] leading-none text-[var(--color-ink)]">
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Panel
        icon="registry"
        title="TLD registry"
        note="rdapBaseUrl is confirmed with a live request; extensions without one are explicitly unsupported"
        actions={
          <span className="mono text-[11px] text-[var(--color-ink-3)]">
            {tlds.length} extensions
          </span>
        }
      >
        <div className="grid-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th>TLD</th>
                <th>Status</th>
                <th>Registry</th>
                <th>RDAP base</th>
                <th>Verified</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {tlds.map((t) => (
                <tr key={t.id}>
                  <td className="primary mono">{t.tld}</td>
                  <td>
                    <Badge tone={TLD_TONE[t.status] ?? "unknown"} dot>
                      {t.status}
                    </Badge>
                  </td>
                  <td>{t.registryName ?? "—"}</td>
                  <td className="mono text-[11.5px]">{t.rdapBaseUrl ?? "—"}</td>
                  <td className="faint">
                    {t.verifiedAt
                      ? new Date(t.verifiedAt).toISOString().slice(0, 10)
                      : "—"}
                  </td>
                  <td className="max-w-[320px] text-[12px]">{t.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        icon="spark"
        title="Source registry"
        note="External providers with permitted-use notes, rate limits and current status"
        actions={
          <span className="mono text-[11px] text-[var(--color-ink-3)]">
            {sources.length} sources
          </span>
        }
      >
        <div className="grid-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Kind</th>
                <th>Status</th>
                <th className="num">Rate limit</th>
                <th>Attribution</th>
                <th>Permitted use</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="primary">{s.name}</td>
                  <td className="mono text-[11.5px]">{s.kind}</td>
                  <td>
                    <Badge tone={SRC_TONE[s.status] ?? "unknown"} dot>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="num">
                    {s.rateLimitPerMinute ? `${s.rateLimitPerMinute}/min` : "n/a"}
                  </td>
                  <td>{s.attributionRequired ? "Required" : "—"}</td>
                  <td className="max-w-[420px] text-[12px]">
                    {s.permittedUseNotes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Note>
        A status of AVAILABLE means a live request has succeeded against the
        provider. Planners and adapters that are not yet wired in are listed as
        such and never implied to be operational.
      </Note>
    </div>
  );
}
