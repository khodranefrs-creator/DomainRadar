"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/badge";
import { Callout } from "@/components/ui";
import { Icon } from "@/components/icons";

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
  ERROR: "bad",
  UNKNOWN: "unknown",
  UNSUPPORTED: "neutral",
  NEEDS_VERIFICATION: "warn",
  DISABLED: "unknown",
  UNKNOWN_TLD: "warn",
};

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  NOT_FOUND: "No record*",
  RATE_LIMITED: "Rate limited",
  ERROR: "Error",
  UNSUPPORTED: "Unsupported",
  NEEDS_VERIFICATION: "Needs verification",
  DISABLED: "Disabled",
  UNKNOWN_TLD: "Unknown TLD",
  UNKNOWN: "Unknown",
};

const CORE = [".com", ".ai", ".si", ".io", ".app"];

function clean(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\s+/g, "")
    .split(".")[0];
}

export function ScannerView() {
  const params = useSearchParams();
  const initialName = clean(params.get("name") ?? "");

  const [name, setName] = useState(initialName);
  const [tlds, setTlds] = useState<TldRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);

  const runSearch = useCallback(async (sld: string, picks: string[]) => {
    if (!sld || picks.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sld, tlds: picks }),
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tlds")
      .then((r) => r.json())
      .then((data: { tlds: TldRow[] }) => {
        if (cancelled) return;
        setTlds(data.tlds);
        const core = data.tlds
          .filter((t) => CORE.includes(t.tld))
          .map((t) => t.tld);
        setSelected(core);
        if (initialName) void runSearch(initialName, core);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the extension registry.");
      });
    return () => {
      cancelled = true;
    };
  }, [initialName, runSearch]);

  function toggle(tld: string) {
    setSelected((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld],
    );
  }

  const verified = tlds.filter((t) => t.status === "AVAILABLE");

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
      <form
        className="panel p-5 lg:sticky lg:top-[76px]"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(clean(name), selected);
        }}
      >
        <div className="eyebrow mb-3">Query</div>
        <label htmlFor="sld" className="field-label">
          Second-level label
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
        <button
          type="submit"
          disabled={loading || selected.length === 0 || name.trim().length === 0}
          className="btn btn-primary mt-3 w-full"
        >
          {loading ? "Checking registry…" : "Check availability"}
        </button>

        <div className="mt-6 flex items-center justify-between">
          <span className="eyebrow">Extensions</span>
          <span className="mono text-[11px] text-[var(--color-ink-3)]">
            {selected.length}/{tlds.length}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => setSelected(verified.map((t) => t.tld))}
          >
            All verified
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => setSelected(CORE.filter((c) => tlds.some((t) => t.tld === c)))}
          >
            Core five
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => setSelected([])}
          >
            Clear
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-4)]">
              Verified endpoints
            </div>
            <div className="flex flex-wrap gap-1.5">
              {verified.map((t) => (
                <button
                  type="button"
                  key={t.tld}
                  onClick={() => toggle(t.tld)}
                  aria-pressed={selected.includes(t.tld)}
                  className="chip"
                  title={t.displayName}
                >
                  {t.tld}
                </button>
              ))}
            </div>
          </div>
          {tlds.some((t) => t.status !== "AVAILABLE") ? (
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-4)]">
                No verified endpoint
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tlds
                  .filter((t) => t.status !== "AVAILABLE")
                  .map((t) => (
                    <button
                      type="button"
                      key={t.tld}
                      onClick={() => toggle(t.tld)}
                      aria-pressed={selected.includes(t.tld)}
                      className="chip opacity-70"
                      title={`${t.displayName} — no verified RDAP endpoint, reported as unsupported`}
                    >
                      {t.tld}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-ink-4)]">
          Extensions without a verified RDAP endpoint are checked as
          &ldquo;unsupported&rdquo; — never guessed.
        </p>
      </form>

      <div className="min-w-0 space-y-6">
        {error ? <Callout tone="bad" title="Lookup failed">{error}</Callout> : null}

        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-[92px]" />
            <div className="skeleton h-64" />
          </div>
        ) : result ? (
          <>
            <div className="panel overflow-hidden">
              <div className="grid grid-cols-2 gap-px bg-[var(--color-line)] sm:grid-cols-4 lg:grid-cols-7">
                {[
                  ["Requested", result.requestedCount],
                  ["Checked", result.checkedCount],
                  ["Registered", result.registeredCount],
                  ["No record*", result.notFoundCount],
                  ["Unsupported", result.unsupportedCount],
                  ["Unresolved", result.unresolvedCount],
                  ["Errors", result.errorCount],
                ].map(([label, value]) => (
                  <div key={String(label)} className="bg-[var(--color-panel)] px-3.5 py-3">
                    <div className="eyebrow !text-[10px]">{label}</div>
                    <div className="mono mt-1.5 text-[20px] leading-none text-[var(--color-ink)]">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <section className="panel-flush">
              <div className="panel-head">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="mono text-[13.5px] font-medium text-[var(--color-ink)]">
                      {result.sld}
                    </span>
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
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">
                    {result.note}
                  </p>
                </div>
              </div>
              <div className="grid-wrap">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Domain</th>
                      <th>Registry state</th>
                      <th>Source</th>
                      <th className="num">HTTP</th>
                      <th>Checked</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.variants.map((v) => (
                      <tr key={v.fqdn}>
                        <td className="primary mono">{v.fqdn}</td>
                        <td>
                          <Badge tone={STATUS_TONE[v.status] ?? "unknown"} dot>
                            {STATUS_LABEL[v.status] ?? v.status}
                          </Badge>
                        </td>
                        <td className="mono text-[11.5px]">
                          {v.providerHost ?? v.source ?? "—"}
                        </td>
                        <td className="num">{v.httpStatus ?? "—"}</td>
                        <td className="faint">
                          {v.cached
                            ? "cached"
                            : v.lastCheckedAt
                              ? new Date(v.lastCheckedAt).toISOString().slice(11, 19)
                              : "—"}
                        </td>
                        <td className="max-w-[280px] text-[12px]">{v.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <p className="text-[11px] text-[var(--color-ink-4)]">* {result.note}</p>
          </>
        ) : (
          <section className="panel-flush">
            <div className="empty">
              <div className="empty-icon">
                <Icon name="investigate" size={20} />
              </div>
              <p className="text-[13.5px] font-medium text-[var(--color-ink)]">
                {initialName ? `No result for “${initialName}”` : "Nothing investigated yet"}
              </p>
              <p className="max-w-sm text-[12px] leading-relaxed text-[var(--color-ink-3)]">
                Enter a second-level label and choose extensions to run a live
                RDAP check. Every row records its registry, HTTP status and the
                exact response.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
