"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { Icon } from "@/components/icons";
import { Empty, Note, Panel, PageHeader } from "@/components/ui";

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

type Tone = Parameters<typeof Badge>[0]["tone"];

const STATUS_TONE: Record<string, Tone> = {
  CANDIDATE: "info",
  SHORTLISTED: "good",
  REJECTED: "bad",
  ARCHIVED: "neutral",
};

const MAX_COMPARE = 4;

type SortKey = "domain" | "extension" | "status" | "updated";

export default function CandidatesPage() {
  const [items, setItems] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [tld, setTld] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 220);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCandidates = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (status) params.set("status", status);
    if (tld) params.set("tld", tld);
    const res = await fetch(`/api/candidates?${params.toString()}`);
    if (!res.ok) throw new Error("Request failed");
    return res.json() as Promise<{ items: Candidate[]; total: number }>;
  }, [query, status, tld]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchCandidates();
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setError(null);
      } catch {
        if (!cancelled) setError("Failed to load candidates.");
      } finally {
        if (!cancelled) setLoading(false);
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
      const res = await fetch("/api/candidates/import", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
      } else {
        setImportResult(
          `Imported ${data.imported} · ${data.skipped ?? 0} skipped · ${data.total ?? 0} stored`,
        );
        if (fileRef.current) fileRef.current.value = "";
        const refreshed = await fetchCandidates();
        setItems(refreshed.items ?? []);
        setTotal(refreshed.total ?? 0);
        setShowImport(false);
      }
    } catch {
      setError("Network error during import.");
    }
  }

  const extensions = useMemo(
    () => Array.from(new Set(items.map((i) => i.tld))).sort(),
    [items],
  );

  const sorted = useMemo(() => {
    const rows = items.slice();
    rows.sort((a, b) => {
      switch (sort) {
        case "domain":
          return a.fqdn.localeCompare(b.fqdn);
        case "extension":
          return a.tld.localeCompare(b.tld) || a.sld.localeCompare(b.sld);
        case "status":
          return a.status.localeCompare(b.status) || a.fqdn.localeCompare(b.fqdn);
        case "updated":
        default:
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
      }
    });
    return rows;
  }, [items, sort]);

  const compareSet = useMemo(
    () => items.filter((i) => selected.includes(i.id)).slice(0, MAX_COMPARE),
    [items, selected],
  );

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, id],
    );
  }

  const filtersActive = Boolean(query || status || tld);

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Candidates under review"
        lead="Domains held locally for research — sorted, filtered and compared here. Import or export CSV at any time; unknown extensions are recorded as NEEDS_VERIFICATION rather than dropped."
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowImport((v) => !v)}
              aria-expanded={showImport}
            >
              <Icon name="plus" size={15} />
              Import
            </button>
            <a href="/api/candidates/export" className="btn btn-primary">
              <Icon name="download" size={15} />
              Export CSV
            </a>
          </>
        }
      />

      {showImport ? (
        <div className="mb-5">
          <Panel
            title="Import candidates"
            icon="pipeline"
            note="CSV with a 'domain' column and optional status / generation_rule / seed_terms / notes"
            flush={false}
            actions={
              <span className="micro">5 MB max · rate limited</span>
            }
          >
            <form onSubmit={handleImport} className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="CSV file"
                className="input h-auto w-auto py-2 text-[12.5px]"
              />
              <button type="submit" className="btn btn-accent">
                Import
              </button>
              <span className="micro">Header row required.</span>
            </form>
          </Panel>
        </div>
      ) : null}

      {error ? (
        <div className="mb-5">
          <div className="rounded-[11px] border border-[color-mix(in_srgb,var(--color-bad)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-bad)_9%,transparent)] px-4 py-3 text-[12.5px] text-[var(--color-ink-2)]">
            {error}
          </div>
        </div>
      ) : null}

      {importResult ? (
        <div className="mb-5 flex items-center gap-2 rounded-[11px] border border-[color-mix(in_srgb,var(--color-ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-ok)_8%,transparent)] px-4 py-3 text-[12.5px] text-[var(--color-ok)]">
          <Icon name="check" size={14} />
          {importResult}
        </div>
      ) : null}

      {compareSet.length > 0 ? (
        <section className="dossier mb-5">
          <div className="dossier-head">
            <div className="min-w-0 flex-1">
              <h2 className="section-title">Comparison</h2>
              <p className="panel-note">
                {compareSet.length} of {MAX_COMPARE} domains · read across, not up
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelected([])}
            >
              <Icon name="close" size={14} />
              Clear
            </button>
          </div>
          <div className="grid-wrap">
            <div
              className="grid gap-px bg-[var(--color-line)]"
              style={{
                gridTemplateColumns: `minmax(160px,1fr) repeat(${compareSet.length}, minmax(150px,1fr))`,
                minWidth: 260 + compareSet.length * 150,
              }}
            >
              <div className="bg-[var(--color-panel)] p-4">
                <div className="eyebrow">Field</div>
              </div>
              {compareSet.map((c) => (
                <div key={c.id} className="bg-[var(--color-panel)] p-4">
                  <div className="mono truncate text-[12.5px] text-[var(--color-ink)]">
                    {c.fqdn}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSelect(c.id)}
                    className="micro mt-1 flex items-center gap-1 hover:text-[var(--color-ink-2)]"
                  >
                    <Icon name="close" size={11} /> remove
                  </button>
                </div>
              ))}

              {(
                [
                  [
                    "Extension",
                    (c: Candidate) => <span className="mono">.{c.tld}</span>,
                  ],
                  [
                    "Status",
                    (c: Candidate) => (
                      <Badge tone={STATUS_TONE[c.status] ?? "neutral"} dot>
                        {c.status.toLowerCase()}
                      </Badge>
                    ),
                  ],
                  [
                    "Rule",
                    (c: Candidate) => (
                      <span className="mono text-[11.5px]">
                        {c.generationRule ?? "—"}
                      </span>
                    ),
                  ],
                  [
                    "Updated",
                    (c: Candidate) => (
                      <span className="mono text-[11.5px]">
                        {new Date(c.updatedAt).toISOString().slice(0, 10)}
                      </span>
                    ),
                  ],
                  [
                    "Notes",
                    (c: Candidate) => (
                      <span className="text-[11.5px] text-[var(--color-ink-2)]">
                        {c.notes ?? "—"}
                      </span>
                    ),
                  ],
                ] as [string, (c: Candidate) => React.ReactNode][]
              ).map(([label, render]) => (
                <Fragment key={label}>
                  <div className="bg-[var(--color-bg-2)] p-4 text-[11.5px] text-[var(--color-ink-3)]">
                    {label}
                  </div>
                  {compareSet.map((c) => (
                    <div key={`${label}-${c.id}`} className="bg-[var(--color-bg-2)] p-4">
                      {render(c)}
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel-flush">
        <div className="panel-head flex-wrap">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[190px] flex-1 sm:max-w-[260px]">
              <Icon
                name="search"
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter domain…"
                className="input pl-9"
                aria-label="Filter candidates by domain"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="select w-auto"
              aria-label="Filter by status"
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
              aria-label="Filter by extension"
            >
              <option value="">All extensions</option>
              {extensions.map((t) => (
                <option key={t} value={t}>
                  .{t}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="select w-auto"
              aria-label="Sort by"
            >
              <option value="updated">Sort: recently updated</option>
              <option value="domain">Sort: domain A–Z</option>
              <option value="extension">Sort: extension</option>
              <option value="status">Sort: status</option>
            </select>
            {filtersActive ? (
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setTld("");
                }}
              >
                Reset
              </button>
            ) : null}
          </div>
          <span className="mono text-[11.5px] text-[var(--color-ink-4)]">
            {loading ? "…" : `${total} stored`}
            {sorted.length !== total ? ` · ${sorted.length} shown` : ""}
          </span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-9" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <Empty
            icon="pipeline"
            title={filtersActive ? "No candidates match those filters" : "No candidates staged"}
            hint={
              filtersActive
                ? "Clear the filters to see the full pipeline."
                : "Investigate a name and stage its no-record extensions, or import a CSV with a 'domain' column."
            }
            action={
              filtersActive ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                    setTld("");
                  }}
                >
                  Reset filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowImport(true)}
                >
                  Import CSV
                </button>
              )
            }
          />
        ) : (
          <div className="grid-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th className="expand" aria-label="Compare" />
                  <th>Domain</th>
                  <th>Status</th>
                  <th className="max-md:hidden">Rule</th>
                  <th className="text-right">Updated</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const open = expanded === c.id;
                  const picked = selected.includes(c.id);
                  return [
                    <tr
                      key={c.id}
                      onClick={() => setExpanded(open ? null : c.id)}
                      className="cursor-pointer"
                    >
                      <td className="expand">
                        <input
                          type="checkbox"
                          checked={picked}
                          onChange={() => toggleSelect(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Compare ${c.fqdn}`}
                          className="h-5 w-5 accent-[var(--color-accent)] max-sm:h-8 max-sm:w-8"
                        />
                      </td>
                      <td className="mono primary">{c.fqdn}</td>
                      <td>
                        <Badge tone={STATUS_TONE[c.status] ?? "neutral"} dot>
                          {c.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="mono max-md:hidden text-[11.5px]">
                        {c.generationRule ?? "—"}
                      </td>
                      <td className="text-right">
                        <span className="faint mono text-[11px]">
                          {new Date(c.updatedAt).toISOString().slice(0, 10)}
                        </span>
                      </td>
                    </tr>,
                    open ? (
                      <tr key={`${c.id}-detail`}>
                        <td colSpan={5} className="row-detail">
                          <dl className="kv">
                            <dt>Domain</dt>
                            <dd className="mono">{c.fqdn}</dd>
                            <dt>Extension</dt>
                            <dd className="mono">.{c.tld}</dd>
                            <dt>Generation rule</dt>
                            <dd className="mono">{c.generationRule ?? "—"}</dd>
                            <dt>Notes</dt>
                            <dd>{c.notes ?? "No notes recorded."}</dd>
                            <dt>Updated</dt>
                            <dd className="mono">
                              {new Date(c.updatedAt).toISOString()}
                            </dd>
                          </dl>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Note>
        Select up to {MAX_COMPARE} rows to compare them side by side. Unknown
        extensions in an import are auto-registered as NEEDS_VERIFICATION rather
        than dropped silently. Records are stored in this instance&rsquo;s database.
      </Note>
    </div>
  );
}
