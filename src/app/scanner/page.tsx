"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatCard, EmptyCard, Section } from "@/components/page-shell";
import { Badge } from "@/components/badge";

interface VariantView {
  tld: string;
  fqdn: string;
  status: string;
  source: string | null;
  sourceKey: string | null;
  providerHost: string | null;
  requestUrl: string | null;
  httpStatus: number | null;
  errorKind: string | null;
  lastCheckedAt: string | null;
  cached: boolean;
  detail: string;
}

interface SearchResponse {
  sessionId: string;
  sld: string;
  status: string;
  requestedCount: number;
  checkedCount: number;
  registeredCount: number;
  notFoundCount: number;
  unsupportedCount: number;
  unresolvedCount: number;
  errorCount: number;
  variants: VariantView[];
  note: string;
}

interface TldRow {
  tld: string;
  status: string;
  displayName: string;
}

type Tone = Parameters<typeof Badge>[0]["tone"];

const STATUS_TONE: Record<string, Tone> = {
  REGISTERED: "bad",
  NOT_FOUND: "info",
  RESERVED: "warn",
  RESTRICTED: "warn",
  RATE_LIMITED: "warn",
  ERROR: "warn",
  UNKNOWN: "unknown",
  UNSUPPORTED: "neutral",
  NEEDS_VERIFICATION: "warn",
  DISABLED: "unknown",
  UNKNOWN_TLD: "warn",
};

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  NOT_FOUND: "Not found*",
  RATE_LIMITED: "Rate limited",
  ERROR: "Error",
  UNSUPPORTED: "Unsupported",
  NEEDS_VERIFICATION: "Needs verification",
  DISABLED: "Disabled",
  UNKNOWN_TLD: "Unknown TLD",
  UNKNOWN: "Unknown",
};

export default function ScannerPage() {
  const [name, setName] = useState("");
  const [tlds, setTlds] = useState<TldRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tlds")
      .then((r) => r.json())
      .then((data: { tlds: TldRow[] }) => {
        if (cancelled) return;
        setTlds(data.tlds);
        setSelected(
          data.tlds
            .filter((t) => [".com", ".ai", ".si", ".io", ".app"].includes(t.tld))
            .map((t) => t.tld),
        );
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the extension registry.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(tld: string) {
    setSelected((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld],
    );
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tlds: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error while contacting the registry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Research"
        title="Domain Scanner"
        description="Live registry lookups (RDAP) across the extensions you select. RDAP reports registry state only — 'Not found' means no registry record was returned, it is NOT proof a domain is available to register."
      />

      <form onSubmit={runSearch}>
        <Section
          title="Query"
          description="Enter the second-level label, then choose the extensions to check."
          actions={
            <span className="text-xs text-[var(--color-faint)]">
              {selected.length} selected
            </span>
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label
                htmlFor="sld"
                className="mb-1.5 block text-xs text-[var(--color-muted)]"
              >
                Name (second-level label)
              </label>
              <input
                id="sld"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input mono"
                placeholder="agentcapability"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="submit"
              disabled={loading || selected.length === 0 || name.trim().length === 0}
              className="btn btn-primary"
            >
              {loading ? "Checking..." : "Check availability"}
            </button>
          </div>

          <fieldset className="mt-5">
            <legend className="eyebrow mb-2">Extensions</legend>
            <div className="flex flex-wrap gap-2">
              {tlds.map((t) => {
                const on = selected.includes(t.tld);
                return (
                  <button
                    type="button"
                    key={t.tld}
                    onClick={() => toggle(t.tld)}
                    aria-pressed={on}
                    className="chip"
                    title={t.displayName}
                  >
                    {t.tld}
                    {t.status !== "AVAILABLE" ? (
                      <span className="text-amber-400">*</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-faint)]">
              * extension has no verified RDAP endpoint — reported as
              unsupported, never guessed.
            </p>
          </fieldset>
        </Section>
      </form>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-600/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mt-6">
        {result ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <StatCard label="Requested" value={result.requestedCount} tone="neutral" />
              <StatCard label="Checked" value={result.checkedCount} tone="info" />
              <StatCard
                label="Registered"
                value={result.registeredCount}
                tone="danger"
              />
              <StatCard label="Not found" value={result.notFoundCount} tone="accent" />
              <StatCard
                label="Unsupported"
                value={result.unsupportedCount}
                tone="neutral"
              />
              <StatCard
                label="Unresolved"
                value={result.unresolvedCount}
                tone="warn"
              />
              <StatCard label="Errors" value={result.errorCount} tone="danger" />
            </div>

            <Section
              title="Results"
              description={result.note}
              padded={false}
              actions={
                <Badge
                  tone={
                    result.status === "COMPLETED"
                      ? "good"
                      : result.status === "FAILED"
                        ? "bad"
                        : "warn"
                  }
                  dot
                >
                  {result.status}
                </Badge>
              }
            >
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Domain</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th className="text-right">HTTP</th>
                      <th>Checked</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.variants.map((v) => (
                      <tr key={v.tld}>
                        <td className="mono font-medium text-[var(--color-fg)]">
                          {v.fqdn}
                        </td>
                        <td>
                          <Badge tone={STATUS_TONE[v.status] ?? "unknown"} dot>
                            {STATUS_LABEL[v.status] ?? v.status}
                          </Badge>
                        </td>
                        <td className="text-[var(--color-muted)]">
                          {v.source ?? "—"}
                        </td>
                        <td className="tnum text-right text-[var(--color-muted)]">
                          {v.httpStatus ?? "—"}
                        </td>
                        <td className="text-[var(--color-muted)]">
                          {v.cached
                            ? "cached"
                            : v.lastCheckedAt
                              ? new Date(v.lastCheckedAt).toISOString().slice(11, 19)
                              : "—"}
                        </td>
                        <td className="max-w-xs text-[var(--color-muted)]">
                          {v.detail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
            <p className="text-xs text-[var(--color-faint)]">
              * {result.note}
            </p>
          </div>
        ) : (
          <EmptyCard
            title="No search yet"
            hint="Choose a name and extensions above, then run a live RDAP check."
          />
        )}
      </div>
    </div>
  );
}
