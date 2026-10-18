"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { Empty, Note, Panel, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

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
  const [showImport, setShowImport] = useState(false);
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
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch("/api/candidates/import", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
      } else {
        setImportResult(
          `Imported ${data.imported} rows · ${data.skipped ?? 0} skipped · ${data.total ?? items.length} stored`,
        );
        if (fileRef.current) fileRef.current.value = "";
        const refreshed = await fetchCandidates();
        setItems(refreshed.items ?? []);
        setTotal(data.total ?? 0);
        setShowImport(false);
      }
    } catch {
      setError("Network error during import");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Candidate domains"
        lead="Domains held locally for research. Import or export CSV. Unknown extensions in an import are registered as NEEDS_VERIFICATION — never dropped silently."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => setShowImport((v) => !v)}
              aria-expanded={showImport}
            >
              <Icon name="spark" size={15} />
              Import
            </button>
            <a href="/api/candidates/export" className="btn btn-ghost">
              Export CSV
            </a>
          </>
        }
      />

      {showImport ? (
        <div className="mb-6">
          <Panel
            title="Import candidates"
            icon="pipeline"
            note="CSV with a 'domain' column and optional status / generation_rule / seed_terms / notes"
            flush={false}
            actions={
              <span className="text-[11px] text-[var(--color-ink-4)]">
                5 MB max · rate limited
              </span>
            }
          >
            <form
              onSubmit={handleImport}
              className="flex flex-wrap items-center gap-3"
            >
              <input
                ref={fileRef}
                id="csv"
                type="file"
                accept=".csv,text/csv"
                className="text-[12.5px] text-[var(--color-ink-2)] file:mr-3 file:rounded-lg file:border file:border-[var(--color-line-2)] file:bg-[var(--color-panel-2)] file:px-3 file:py-1.5 file:text-[11.5px] file:text-[var(--color-ink)]"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Import CSV
              </button>
              {importResult ? (
                <span className="text-[11.5px] text-[var(--color-ok)]">
                  {importResult}
                </span>
              ) : null}
            </form>
          </Panel>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <div className="rounded-[10px] border border-[color-mix(in_srgb,var(--color-bad)_34%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_10%,transparent)] px-4 py-3 text-[12.5px] text-[var(--color-ink)]">
            {error}
          </div>
        </div>
      ) : null}

      <section className="panel-flush">
        <div className="panel-head flex-wrap">
          <div className="flex flex-1 items-center gap-2.5">
            <div className="relative flex-1 sm:max-w-[280px]">
              <Icon
                name="search"
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-4)]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter domain…"
                className="input pl-9"
                aria-label="Filter candidates"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="select w-auto"
              aria-label="Filter status"
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
              className="select w-auto"
              aria-label="Filter extension"
            >
              <option value="">All extensions</option>
              {Array.from(new Set(items.map((i) => i.tld)))
                .sort()
                .map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          </div>
          <span className="mono text-[11.5px] text-[var(--color-ink-3)]">
            {total} total
          </span>
        </div>

        {items.length === 0 ? (
          <Empty
            icon="pipeline"
            title="No candidates staged"
            hint="Import a CSV with a 'domain' column, e.g. agentcapability.com, or investigate a name and add it to the pipeline."
            action={
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowImport(true)}
              >
                Import CSV
              </button>
            }
          />
        ) : (
          <div className="grid-wrap">
            <table className="grid-table">
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
                    <td className="primary mono">{c.fqdn}</td>
                    <td className="mono">{c.tld}</td>
                    <td>
                      <Badge tone={STATUS_TONE[c.status] ?? "neutral"} dot>
                        {c.status}
                      </Badge>
                    </td>
                    <td>{c.generationRule ?? "—"}</td>
                    <td className="faint mono">
                      {new Date(c.updatedAt).toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Note>
        Unknown extensions in an import are auto-registered as NEEDS_VERIFICATION
        rather than dropped silently. Records are stored locally in this instance.
      </Note>
    </div>
  );
}
