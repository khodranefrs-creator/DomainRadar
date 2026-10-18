import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { tldRepository } from "@/lib/repository";
import { PageHeader } from "@/components/page-shell";
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
    <div className="space-y-10">
      <Suspense fallback={<SourcesSkeleton />}>
        <RegistryTables />
      </Suspense>
    </div>
  );
}

function SourcesSkeleton() {
  return (
    <div className="space-y-10">
      {[0, 1].map((i) => (
        <div key={i}>
          <div className="h-6 w-48 bg-[var(--color-surface-2)] rounded mb-4 animate-pulse" />
          <div className="h-64 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] animate-pulse" />
        </div>
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
    <>
      <div>
        <PageHeader
          title="TLD Registry"
          description="Which extensions can actually be checked, and how. rdapBaseUrl was confirmed with a live request on 2026-10-18. Extensions without a verified endpoint are explicitly UNSUPPORTED — never silently omitted or guessed."
        />
        <table className="w-full text-sm border border-[var(--color-border)] rounded-lg overflow-hidden">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-muted)] text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">TLD</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Registry</th>
              <th className="text-left px-3 py-2 font-medium">RDAP base</th>
              <th className="text-left px-3 py-2 font-medium">Verified</th>
              <th className="text-left px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {tlds.map((t) => (
              <tr key={t.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-mono">{t.tld}</td>
                <td className="px-3 py-2">
                  <Badge tone={TLD_TONE[t.status] ?? "unknown"}>{t.status}</Badge>
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {t.registryName ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted)]">
                  {t.rdapBaseUrl ?? "—"}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {t.verifiedAt ? t.verifiedAt.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)] text-xs">
                  {t.notes ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <PageHeader
          title="Source Registry"
          description="Every external provider with its permitted-use notes, rate limits and current status. A planned adapter is never shown as operational."
        />
        <table className="w-full text-sm border border-[var(--color-border)] rounded-lg overflow-hidden">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-muted)] text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Source</th>
              <th className="text-left px-3 py-2 font-medium">Kind</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Rate limit</th>
              <th className="text-left px-3 py-2 font-medium">Attribution</th>
              <th className="text-left px-3 py-2 font-medium">Permitted use</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2 text-[var(--color-muted)]">{s.kind}</td>
                <td className="px-3 py-2">
                  <Badge tone={SRC_TONE[s.status] ?? "unknown"}>{s.status}</Badge>
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {s.rateLimitPerMinute ? `${s.rateLimitPerMinute}/min` : "n/a"}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {s.attributionRequired ? "Required" : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-muted)] max-w-md">
                  {s.permittedUseNotes ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
