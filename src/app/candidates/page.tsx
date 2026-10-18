"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader, Section, EmptyCard } from "@/components/page-shell";
import { Badge } from "@/components/badge";

interface Candidate {
  id: string;
  fqdn: string;
  sld: string;
  tld: string;
  status: string;
  generationRule: string | null;
  notes: string | null;
  updatedAt: string;
}

const STATUS_TONE: Record<
  string,
  "neutral" | "good" | "warn" | "bad" | "info" | "unknown"
> = {
  CANDIDATE: "info",
  SHORTLISTED: "good",
  REJECTED: "bad",
  ARCHIVED: "neutral",
};

export default function CandidatesPage() {
  const [items, setItems] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tld, setTld] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCandidates = useCallback(async (): Promise<{
    items: Candidate[];
    total: number;
  }> => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (tld) params.set("tld", tld);
    const res = await fetch(`/api/candidates?${params.toString()}`);
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  }, [search, status, tld]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCandidates();
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setError(null);
      } catch {
        if (!cancelled) setError("Failed to load candidates");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCandidates]);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImportResult(null);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/candidates/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
      } else {
        const r = data.result;
        setImportResult(
          `Imported ${r.importedRows} of ${r.totalRows} rows · ${r.errorRows} errors · ${r.skippedRows} blank skipped.`,
        );
        if (fileRef.current) fileRef.current.value = "";
        const refreshed = await fetchCandidates();
        setItems(refreshed.items ?? []);
        setTotal(refreshed.total ?? 0);
      }
    } catch {
      setError("Network error during import");
    }
  }

  const tldOptions = Array.from(new Set(items.map((i) => i.tld))).sort();
  return (
    <div>
      <PageHeader
        eyebrow="Research"
        title="Candidates"
        description="Domain candidates stored locally. Import and export CSV. Unknown extensions in an import are auto-registered as NEEDS_VERIFICATION — never dropped silently."
        actions={
          <a href="/api/candidates/export" className="btn btn-ghost">
            Export CSV
          </a>
        }
      />

      <Section
        title="Import candidates"
        description="CSV with a 'domain' column and optional status / generation_rule / seed_terms / notes."
        actions={
          <span className="text-xs text-[var(--color-faint)]">
            5 MB max · rate limited
          </span>
        }
      >
        <form onSubmit={handleImport} className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            id="csv"
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-[var(--color-muted)] file:mr-3 file:rounded-md file:border file:border-[var(--color-border-strong)] file:bg-[var(--color-surface-2)] file:px-3 file:py-1.5 file:text-xs file:text-[var(--color-fg)]"
          />
          <button type="submit" className="btn btn-primary">
            Import
          </button>
          {importResult ? (
            <span className="text-xs text-emerald-400">{importResult}</span>
          ) : null}
        </form>
      </Section>

      <div className="my-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by domain..."
          className="input w-64 max-w-full"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="select w-44"
        >
          <option value="">All statuses</option>
          <option value="CANDIDATE">Candidate</option>
          <option value="SHORTLISTED">Shortlisted</option>
          <option value="REJECTED">Rejected</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={tld}
          onChange={(e) => setTld(e.target.value)}
          className="select w-36"
        >
          <option value="">All extensions</option>
          {tldOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-[var(--color-muted)]">
          {total} total
        </span>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-600/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyCard
          title="No candidates"
          hint="Import a CSV with a 'domain' column, e.g. agentcapability.com"
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Extension</th>
                  <th>Status</th>
                  <th>Generation rule</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td className="mono font-medium text-[var(--color-fg)]">
                      {c.fqdn}
                    </td>
                    <td className="mono text-[var(--color-muted)]">{c.tld}</td>
                    <td>
                      <Badge tone={STATUS_TONE[c.status] ?? "neutral"} dot>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="text-[var(--color-muted)]">
                      {c.generationRule ?? "—"}
                    </td>
                    <td className="tnum text-[var(--color-muted)]">
                      {new Date(c.updatedAt).toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
