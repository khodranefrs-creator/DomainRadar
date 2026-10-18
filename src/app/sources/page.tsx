import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { tldRepository } from "@/lib/repository";
import { Badge } from "@/components/badge";
import { Icon } from "@/components/icons";
import { Note, PageHeader, StatLine } from "@/components/ui";
import { SourceStatus, TldStatus } from "@/lib/enums";

export const metadata: Metadata = {
  title: "Registry",
};

export default function SourcesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Registry"
        title="What can actually be checked"
        lead="Every extension Domain Radar can query, and every external provider behind it — with status, rate limits and permitted-use notes. A planned adapter is never shown as operational."
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
      <div className="skeleton h-[54px]" />
      <div className="skeleton h-72" />
      <div className="skeleton h-72" />
    </div>
  );
}

type Tone = Parameters<typeof Badge>[0]["tone"];

const TLD_TONE: Record<string, Tone> = {
  AVAILABLE: "good",
  NEEDS_VERIFICATION: "warn",
  DISABLED: "bad",
  UNSUPPORTED: "unknown",
};

const SRC_TONE: Record<string, Tone> = {
  AVAILABLE: "good",
  MANUAL_ONLY: "info",
  DISABLED: "bad",
  RATE_LIMITED: "warn",
  NEEDS_CONFIGURATION: "warn",
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function RegistryData() {
  const [tlds, sources] = await Promise.all([
    tldRepository.list(),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
  ]);

  const available = tlds.filter((t) => t.status === TldStatus.AVAILABLE);
  const unsupported = tlds.filter((t) => t.status === TldStatus.UNSUPPORTED);
  const needing = tlds.filter((t) => t.status === TldStatus.NEEDS_VERIFICATION);
  const operational = sources.filter((s) => s.status === SourceStatus.AVAILABLE).length;

  const sorted = [...tlds].sort(
    (a, b) => Number(b.status === TldStatus.AVAILABLE) - Number(a.status === TldStatus.AVAILABLE),
  );

  return (
    <div className="space-y-6">
      <StatLine
        items={[
          { label: "Extensions tracked", value: tlds.length },
          { label: "Queryable now", value: available.length, tone: "accent" },
          { label: "Unsupported", value: unsupported.length },
          { label: "Needs verification", value: needing.length },
          { label: "Sources operational", value: `${operational}/${sources.length}` },
        ]}
      />

      <section className="panel-flush">
        <div className="panel-head">
          <div className="min-w-0">
            <h2 className="panel-title">
              <Icon name="globe" size={15} />
              Extensions
            </h2>
            <p className="panel-note">
              Queryable first · each base URL is confirmed by a live request before
              the extension is marked available
            </p>
          </div>
          <span className="mono text-[11px] text-[var(--color-ink-4)]">
            {tlds.length} rows
          </span>
        </div>
        <div className="grid-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Extension</th>
                <th>Status</th>
                <th>Registry</th>
                <th>RDAP base</th>
                <th className="text-right">Verified</th>
                <th className="max-md:hidden">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td className="primary mono">{t.tld}</td>
                  <td>
                    <Badge tone={TLD_TONE[t.status] ?? "unknown"} dot>
                      {titleCase(t.status)}
                    </Badge>
                  </td>
                  <td className="max-md:hidden">{t.registryName ?? "—"}</td>
                  <td className="mono max-w-[300px] truncate text-[11.5px]">
                    {t.rdapBaseUrl ?? "—"}
                  </td>
                  <td className="text-right faint mono text-[11px]">
                    {t.verifiedAt ? new Date(t.verifiedAt).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="max-w-[340px] text-[12px] max-lg:hidden">
                    {t.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-flush">
        <div className="panel-head">
          <div className="min-w-0">
            <h2 className="panel-title">
              <Icon name="layers" size={15} />
              Sources
            </h2>
            <p className="panel-note">
              Providers with rate limits, attribution and permitted-use notes
            </p>
          </div>
          <span className="mono text-[11px] text-[var(--color-ink-4)]">
            {sources.length} rows
          </span>
        </div>
        <div className="grid-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Kind</th>
                <th>Status</th>
                <th className="text-right">Rate limit</th>
                <th className="max-md:hidden">Attribution</th>
                <th className="max-lg:hidden">Permitted use</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="primary">{s.name}</td>
                  <td className="mono text-[11.5px]">{s.kind}</td>
                  <td>
                    <Badge tone={SRC_TONE[s.status] ?? "unknown"} dot>
                      {titleCase(s.status)}
                    </Badge>
                  </td>
                  <td className="num">
                    {s.rateLimitPerMinute ? `${s.rateLimitPerMinute}/min` : "n/a"}
                  </td>
                  <td className="max-md:hidden">
                    {s.attributionRequired ? (
                      <span className="status text-[var(--color-warn)]">
                        <span className="dot bg-[var(--color-warn)]" aria-hidden />
                        Required
                      </span>
                    ) : (
                      <span className="faint">Not required</span>
                    )}
                  </td>
                  <td className="max-w-[440px] text-[12px] max-lg:hidden">
                    {s.permittedUseNotes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Note>
        AVAILABLE means a live request has succeeded against the provider.
        Adapters that are not wired in are listed with their true status and never
        implied to be operational. Attribution requirements are surfaced here before
        any data is reused.
      </Note>
    </div>
  );
}
