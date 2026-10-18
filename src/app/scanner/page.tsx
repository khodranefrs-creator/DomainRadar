"use client";

import { useEffect, useState } from "react";
import { PageHeader, StatCard, EmptyCard } from "@/components/page-shell";
import { Badge } from "@/components/badge";

interface VariantView {
  tld: string;
  fqdn: string;
  status:
    | "PENDING_CHECK"
    | "UNSUPPORTED"
    | "NEEDS_VERIFICATION"
    | "DISABLED"
    | "UNKNOWN_TLD";
  source: string | null;
  lastCheckedAt: string | null;
  detail: string;
}

interface SearchResponse {
  sessionId: string;
  sld: string;
  requestedCount: number;
  unsupportedCount: number;
  unresolvedCount: number;
  checkedCount: number;
  variants: VariantView[];
  note: string;
}

interface TldRow {
  tld: string;
  status: string;
  displayName: string;
}

const STATUS_TONE: Record<VariantView["status"], Parameters<typeof Badge>[0]["tone"]> = {
  PENDING_CHECK: "info",
  UNSUPPORTED: "unknown",
  NEEDS_VERIFICATION: "warn",
  DISABLED: "unknown",
  UNKNOWN_TLD: "warn",
};

export default function ScannerPage() {
  const [name, setName] = useState("AgentCapability");
  const [tlds, setTlds] = useState<TldRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tlds")
      .then((r) => r.json())
      .then((data: { tlds: TldRow[] }) => {
        setTlds(data.tlds);
        setSelected(
          data.tlds
            .filter((t) => [".com", ".ai", ".si", ".io", ".app"].includes(t.tld))
            .map((t) => t.tld),
        );
      })
      .catch(() => setError("Could not load TLD registry"));
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
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Domain Scanner"
        description="Enter a name to see its variants across the selected extensions. This milestone enumerates and records the search; live RDAP availability checks arrive in Milestone 2. No variant is ever marked available without a verified lookup."
      />

      <form onSubmit={runSearch} className="mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="sld" className="block text-xs text-[var(--color-muted)] mb-1">
              Name (second-level label)
            </label>
            <input
              id="sld"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm w-72 font-mono"
              placeholder="AgentCapability"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={loading || selected.length === 0}
            className="px-4 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Working…" : "Show variants"}
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="text-xs text-[var(--color-muted)] mb-2">
            Extensions ({selected.length} selected)
          </legend>
          <div className="flex flex-wrap gap-2">
            {tlds.map((t) => {
              const on = selected.includes(t.tld);
              return (
                <button
                  type="button"
                  key={t.tld}
                  onClick={() => toggle(t.tld)}
                  aria-pressed={on}
                  className={[
                    "px-2.5 py-1 rounded-md text-xs font-mono border",
                    on
                      ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                      : "bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)]",
                  ].join(" ")}
                >
                  {t.tld}
                  {t.status !== "AVAILABLE" ? " *" : ""}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--color-muted)] mt-2">
            * extension is not a verified RDAP-available TLD — see Sources &amp; TLDs.
          </p>
        </fieldset>
      </form>

      {error ? (
        <div className="border border-red-600/50 bg-red-500/10 text-red-300 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      ) : null}

      {result ? (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <StatCard label="Requested" value={result.requestedCount} />
            <StatCard label="Checked" value={result.checkedCount} hint="Milestone 2" />
            <StatCard label="Unsupported" value={result.unsupportedCount} />
            <StatCard label="Unresolved" value={result.unresolvedCount} />
            <StatCard label="Variants" value={result.variants.length} />
          </div>

          <table className="w-full text-sm border border-[var(--color-border)] rounded-lg overflow-hidden">
            <thead className="bg-[var(--color-surface-2)] text-[var(--color-muted)] text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Domain</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Source</th>
                <th className="text-left px-3 py-2 font-medium">Last checked</th>
                <th className="text-left px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {result.variants.map((v) => (
                <tr key={v.tld} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 font-mono">{v.fqdn}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-muted)]">
                    {v.source ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-muted)]">
                    {v.lastCheckedAt ?? "never"}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-muted)]">{v.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-[var(--color-muted)] mt-3">{result.note}</p>
        </div>
      ) : (
        <EmptyCard
          title="No search yet"
          hint="Choose extensions and a name, then run the search."
        />
      )}
    </div>
  );
}
