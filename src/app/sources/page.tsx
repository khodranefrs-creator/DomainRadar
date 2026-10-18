import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { tldRepository } from "@/lib/repository";
import { PageHeader, Section } from "@/components/page-shell";
import { Badge } from "@/components/badge";

const TLD_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info" | "unknown"> = {
  AVAILABLE: "good",
  UNSUPPORTED: "neutral",
  NEEDS_VERIFICATION: "warn",
  DISABLED: "bad",
};

const SRC_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info" | "unknown"> = {
  AVAILABLE: "good",
  MANUAL_ONLY: "info",
  DISABLED: "bad",
  RATE_LIMITED: "warn",
  NEEDS_CONFIGURATION: "warn",
};

export default function SourcesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Registry"
        title="Sources & TLDs"
        description="Exactly which extensions can be checked, and every external provider with its permitted-use notes and current status. A planned adapter is never shown as operational."
      />
      <Suspense fallback={<SourcesSkeleton />}>
        <RegistryTables />
      </Suspense>
    </div>
  );
}

function SourcesSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1].map((i) => (
        <div key={i} className="panel h-72 animate-pulse" />
      ))}
    </div>
  );
}

async function RegistryTables() {
  const [tlds, sources] = await Promise.all([
    tldRepository.list(),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <Section
        title="TLD registry"
        description="rdapBaseUrl is confirmed with a live request. Extensions without a verified endpoint are explicitly UNSUPPORTED — never silently omitted."
        padded={false}
        actions={
          <span className="text-xs text-[var(--color-faint)]">
            {tlds.length} extensions
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="data-table">
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
                  <td className="mono font-medium text-[var(--color-fg)]">
                    {t.tld}
                  </td>
                  <td>
                    <Badge tone={TLD_TONE[t.status] ?? "unknown"} dot>
                      {t.status}
                    </Badge>
                  </td>
                  <td className="text-[var(--color-muted)]">
                    {t.registryName ?? "—"}
                  </td>
                  <td className="mono text-xs text-[var(--color-muted)]">
                    {t.rdapBaseUrl ?? "—"}
                  </td>
                  <td className="tnum text-[var(--color-muted)]">
                    {t.verifiedAt ? t.verifiedAt.toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="max-w-xs text-xs text-[var(--color-muted)]">
                    {t.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Source registry"
        description="External providers with permitted-use notes, rate limits and current status."
        padded={false}
        actions={
          <span className="text-xs text-[var(--color-faint)]">
            {sources.length} sources
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Rate limit</th>
                <th>Attribution</th>
                <th>Permitted use</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-[var(--color-fg)]">{s.name}</td>
                  <td className="text-[var(--color-muted)]">{s.kind}</td>
                  <td>
                    <Badge tone={SRC_TONE[s.status] ?? "unknown"} dot>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="tnum text-[var(--color-muted)]">
                    {s.rateLimitPerMinute ? `${s.rateLimitPerMinute}/min` : "n/a"}
                  </td>
                  <td className="text-[var(--color-muted)]">
                    {s.attributionRequired ? "Required" : "—"}
                  </td>
                  <td className="max-w-md text-xs text-[var(--color-muted)]">
                    {s.permittedUseNotes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
