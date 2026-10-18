"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader, EmptyCard } from "@/components/page-shell";
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

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info" | "unknown"> = {
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
      const res = await fetch("/api/candidates/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
      } else {
        const r = data.result;
        setImportResult(
          `Imported ${r.importedRows} of ${r.totalRows} rows; ${r.errorRows} errors, ${r.skippedRows} blank skipped.`,
        );
        if (fileRef.current) fileRef.current.value = "";
        const refreshed = await fetchCandidates();
        setItems(refreshed.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      setError("Network error during import");
    }
  }

  const tldOptions = Array.from(new Set(items.map((i) => i.tld))).sort();

  return (
    <div>
      <PageHeader
        title="Candidates"
        description="Domain candidates stored locally. Import and export CSV. Unknown extensions in an import are auto-registered as NEEDS_VERIFICATION, never dropped silently."
        actions={
          <a
            href="/api/candidates/export"
            className="text-sm px-3 py-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
          >
            Export CSV
          </a>
        }
      />

      <form
        onSubmit={handleImport}
        className="flex flex-wrap items-center gap-3 mb-4 border border-[var(--color-border)] rounded-lg px-4 py-3 bg-[var(--color-surface)]"
      >
        <label className="text-xs text-[var(--color-muted)]" htmlFor="csv">
          Import CSV (column: domain, optional status / generation_rule / seed_terms / notes)
        </label>
        <input
          ref={fileRef}
          id="csv"
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium"
        >
          Import
        </button>
        {importResult ? (
          <span className="text-xs text-emerald-400">{importResult}</span>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by domainâ€¦"
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm w-64"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {["CANDIDATE", "SHORTLISTED", "REJECTED", "ARCHIVED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={tld}
          onChange={(e) => setTld(e.target.value)}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
        >
          <option value="">All extensions</option>
          {tldOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--color-muted)] self-center">
          {total} total
        </span>
      </div>

      {error ? (
        <div className="border border-red-600/50 bg-red-500/10 text-red-300 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyCard
          title="No candidates"
          hint="Import a CSV with a 'domain' column, e.g. agentcapability.com"
        />
      ) : (
        <table className="w-full text-sm border border-[var(--color-border)] rounded-lg overflow-hidden">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-muted)] text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Domain</th>
              <th className="text-left px-3 py-2 font-medium">Extension</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Generation rule</th>
              <th className="text-left px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-mono">{c.fqdn}</td>
                <td className="px-3 py-2 font-mono text-[var(--color-muted)]">{c.tld}</td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {c.generationRule ?? "â€”"}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">
                  {new Date(c.updatedAt).toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

