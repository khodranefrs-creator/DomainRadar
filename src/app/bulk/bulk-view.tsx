"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { Icon } from "@/components/icons";
import { Callout, Empty, Note, PageHeader, Panel } from "@/components/ui";

interface TldRow {
  tld: string;
  status: string;
  displayName: string;
}

interface JobItem {
  id: string;
  fqdn: string;
  tld: string;
  status: string;
  attempts: number;
  normalizedStatus: string | null;
  httpStatus: number | null;
  providerHost: string | null;
  requestUrl: string | null;
  errorKind: string | null;
  errorDetails: string | null;
  responseMs: number | null;
  isFresh: boolean;
  checkedAt: string | null;
}

interface JobSummary {
  id: string;
  status: string;
  sourceLabel: string | null;
  totalItems: number;
  pendingCount: number;
  runningCount: number;
  doneCount: number;
  failedCount: number;
  skippedCount: number;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface CreateResponse {
  job: JobSummary;
  rejected: { line: number; value: string; reason: string }[];
  rejectedTotal: number;
  overflow: number;
}

type Tone = Parameters<typeof Badge>[0]["tone"];

const ITEM_TONE: Record<string, Tone> = {
  DONE: "good",
  FAILED: "bad",
  SKIPPED: "neutral",
  RUNNING: "info",
  PENDING: "unknown",
};

const ITEM_LABEL: Record<string, string> = {
  DONE: "Resolved",
  FAILED: "Failed",
  SKIPPED: "Skipped",
  RUNNING: "Running",
  PENDING: "Queued",
};

const AVAIL_TONE: Record<string, Tone> = {
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
};

const JOB_TONE: Record<string, Tone> = {
  PENDING: "unknown",
  RUNNING: "info",
  PAUSED: "warn",
  CANCELLED: "neutral",
  COMPLETED: "good",
  FAILED: "bad",
};

const CORE = [".com", ".ai", ".si", ".io", ".app"];
const SAMPLE = "agentcapability\nnorthwindcapital\nlumenfoundry";

type SaveState = "saving" | "saved" | "error";

export function BulkView() {
  const [tlds, setTlds] = useState<TldRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<CreateResponse | null>(null);

  const [job, setJob] = useState<JobSummary | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [running, setRunning] = useState(false);
  const [itemFilter, setItemFilter] = useState<string>("");

  const [saved, setSaved] = useState<Record<string, SaveState>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tlds")
      .then((r) => r.json())
      .then((data: { tlds: TldRow[] }) => {
        if (cancelled) return;
        setTlds(data.tlds);
        setSelected(
          data.tlds.filter((t) => CORE.includes(t.tld)).map((t) => t.tld),
        );
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the extension registry.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const verified = tlds.filter((t) => t.status === "AVAILABLE");
  const others = tlds.filter((t) => t.status !== "AVAILABLE");

  function toggle(tld: string) {
    setSelected((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld],
    );
  }

  const refreshItems = useCallback(async (id: string) => {
    const res = await fetch(`/api/jobs/${id}?limit=1000`);
    if (!res.ok) return null;
    const data = await res.json();
    setJob(data.job);
    setItems(data.items);
    return data.job as JobSummary;
  }, []);

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setCreateResult(null);
    setNotice(null);
    setSaved({});
    if (selected.length === 0) {
      setError("Choose at least one extension.");
      return;
    }
    const file = fileRef.current?.files?.[0];
    setCreating(true);
    try {
      let res: Response;
      if (file) {
        const body = new FormData();
        body.set("file", file);
        body.set("tlds", JSON.stringify(selected));
        res = await fetch("/api/jobs", { method: "POST", body });
      } else {
        res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, tlds: selected }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create the scan.");
        return;
      }
      setCreateResult(data);
      setJob(data.job);
      if (fileRef.current) fileRef.current.value = "";
      await refreshItems(data.job.id);
    } catch {
      setError("Network error while creating the scan.");
    } finally {
      setCreating(false);
    }
  }

  const driveJob = useCallback(
    async (id: string) => {
      cancelRef.current = false;
      setRunning(true);
      try {
        for (;;) {
          if (cancelRef.current) break;
          const res = await fetch(`/api/jobs/${id}/step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ maxItems: 40 }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(data.error ?? "A batch step failed.");
            break;
          }
          const step = await res.json();
          await refreshItems(id);
          if (!step.hasMore) break;
        }
      } catch {
        setError("Network error while running the scan.");
      } finally {
        setRunning(false);
        await refreshItems(id);
      }
    },
    [refreshItems],
  );

  async function start() {
    if (!job) return;
    setNotice(null);
    await driveJob(job.id);
  }

  async function cancel() {
    if (!job) return;
    cancelRef.current = true;
    await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" });
    await refreshItems(job.id);
  }

  async function retryFailed() {
    if (!job) return;
    await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
    await refreshItems(job.id);
    setNotice("Failed items requeued — run again to retry them.");
  }

  async function stage(item: JobItem) {
    setSaved((s) => ({ ...s, [item.fqdn]: "saving" }));
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: item.fqdn,
          status: "CANDIDATE",
          generationRule: "bulk-scan",
          notes: `Staged from bulk scan · ${item.normalizedStatus ?? item.status}${
            item.checkedAt ? ` · ${item.checkedAt}` : ""
          }`,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved((s) => ({ ...s, [item.fqdn]: "saved" }));
    } catch {
      setSaved((s) => ({ ...s, [item.fqdn]: "error" }));
    }
  }

  async function stageAllResolved() {
    setNotice(null);
    const targets = items.filter(
      (i) => i.status === "DONE" && i.normalizedStatus === "NOT_FOUND",
    );
    for (const it of targets) {
      if (saved[it.fqdn] === "saved") continue;
      await stage(it);
    }
    setNotice(`${targets.length} no-record names staged in the pipeline.`);
  }

  const filtered = useMemo(() => {
    if (!itemFilter) return items;
    return items.filter((i) => i.status === itemFilter);
  }, [items, itemFilter]);

  const resolvedNoRecord = useMemo(
    () =>
      items.filter(
        (i) => i.status === "DONE" && i.normalizedStatus === "NOT_FOUND",
      ),
    [items],
  );

  const processed =
    job ? job.doneCount + job.failedCount + job.skippedCount : 0;
  const pct = job && job.totalItems > 0 ? Math.round((processed / job.totalItems) * 100) : 0;
  const terminal =
    job?.status === "COMPLETED" ||
    job?.status === "CANCELLED" ||
    job?.status === "FAILED";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Research"
        title="Bulk scan"
        lead="Paste a list of names or domains, or upload a CSV. Each label is expanded across the extensions you choose and checked over RDAP. The job is durable: it can be paused, resumed and cancelled without losing per-domain results."
      />

      <Panel
        icon="layers"
        title="Input"
        note="Bare labels expand across the selected extensions; full domains keep their own extension."
        flush={false}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="seg" role="group" aria-label="Quick scopes">
              <button
                type="button"
                onClick={() =>
                  setSelected(CORE.filter((c) => tlds.some((t) => t.tld === c)))
                }
              >
                Core five
              </button>
              <button type="button" onClick={() => setSelected(verified.map((t) => t.tld))}>
                All verified
              </button>
              <button type="button" onClick={() => setSelected(tlds.map((t) => t.tld))}>
                Everything
              </button>
            </div>
            <span className="mono text-[11.5px] text-[var(--color-ink-3)]">
              {selected.length} of {tlds.length} extensions
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm ml-auto"
              onClick={() => setShowPicker((v) => !v)}
              aria-expanded={showPicker}
            >
              <Icon name="filter" size={14} />
              {showPicker ? "Hide extensions" : "Choose extensions"}
            </button>
          </div>

          {showPicker ? (
            <div className="space-y-4 rounded-[var(--r-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
              <div>
                <div className="eyebrow mb-2">Verified endpoint</div>
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
              {others.length > 0 ? (
                <div>
                  <div className="eyebrow mb-2">No verified endpoint</div>
                  <div className="flex flex-wrap gap-1.5">
                    {others.map((t) => (
                      <button
                        type="button"
                        key={t.tld}
                        onClick={() => toggle(t.tld)}
                        aria-pressed={selected.includes(t.tld)}
                        className="chip"
                        data-dim="true"
                        title={`${t.displayName} — recorded as unsupported, no lookup`}
                      >
                        {t.tld}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <label htmlFor="bulk-text" className="field-label">
              Names or domains
            </label>
            <textarea
              id="bulk-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              spellCheck={false}
              placeholder={`One per line, or separated by commas/spaces.\n\n${SAMPLE}`}
              className="textarea mono text-[13px]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="btn btn-ghost btn-sm cursor-pointer">
                <Icon name="upload" size={14} />
                Upload CSV
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={() => void handleCreate()}
                />
              </label>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => setText(SAMPLE)}
              >
                Use sample
              </button>
              <span className="micro">
                CSV needs a <span className="mono">domain</span> column. Up to
                3,000 domains per job; 5&nbsp;MB cap.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={creating || (!text.trim() && !fileRef.current?.files?.[0])}
              className="btn btn-accent"
            >
              {creating ? (
                <>
                  <Icon name="refresh" size={15} className="spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Icon name="layers" size={15} />
                  Validate & prepare
                </>
              )}
            </button>
            {job && !running && !terminal ? (
              <button type="button" onClick={() => void start()} className="btn btn-primary">
                <Icon name="arrow" size={15} />
                Run scan
              </button>
            ) : null}
            <Note>
              Preparing does not contact any registry — it only validates,
              dedupes and expands your input.
            </Note>
          </div>
        </form>
      </Panel>

      {error ? (
        <Callout tone="bad" title="Something went wrong" icon="alert">
          {error}
        </Callout>
      ) : null}

      {createResult && createResult.rejected.length > 0 ? (
        <Callout tone="warn" title={`${createResult.rejectedTotal} line(s) rejected`} icon="info">
          <ul className="mt-1 space-y-0.5">
            {createResult.rejected.slice(0, 6).map((r, i) => (
              <li key={i} className="mono text-[12px]">
                {r.line ? `line ${r.line}: ` : ""}
                {r.value || "(empty)"} — {r.reason}
              </li>
            ))}
            {createResult.rejectedTotal > 6 ? (
              <li className="mono text-[12px]">
                …and {createResult.rejectedTotal - 6} more
              </li>
            ) : null}
          </ul>
        </Callout>
      ) : null}

      {job ? (
        <section className="panel-flush">
          <div className="panel-head flex-wrap gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="panel-title">Scan progress</h2>
                <Badge dot tone={JOB_TONE[job.status] ?? "unknown"}>
                  {job.status.toLowerCase()}
                </Badge>
                <span className="micro mono">job {job.id.slice(0, 8)}</span>
              </div>
              <p className="panel-note">
                {job.sourceLabel ? `Source: ${job.sourceLabel} · ` : ""}
                {processed} of {job.totalItems} processed
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <button type="button" onClick={() => void cancel()} className="btn btn-ghost btn-sm">
                  <Icon name="close" size={14} />
                  Stop
                </button>
              ) : !terminal ? (
                <button type="button" onClick={() => void start()} className="btn btn-accent btn-sm">
                  <Icon name="arrow" size={14} />
                  {processed > 0 ? "Resume" : "Run scan"}
                </button>
              ) : null}
              <a href={`/api/jobs/${job.id}/export`} className="btn btn-sm">
                <Icon name="download" size={14} />
                Export CSV
              </a>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-3)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <dl className="statline mt-4 rounded-none border-0">
              {[
                ["Total", job.totalItems, "neutral"],
                ["Resolved", job.doneCount, "ok"],
                ["Queued", job.pendingCount, "neutral"],
                ["Failed", job.failedCount, "bad"],
                ["Skipped", job.skippedCount, "unknown"],
              ].map(([label, value, tone]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd style={{ color: `var(--color-${tone === "neutral" ? "ink" : tone})` }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {notice ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] bg-[var(--color-ok-soft)] px-5 py-2.5 text-[12.5px] font-medium text-[var(--color-ok)]">
              <Icon name="check" size={14} />
              {notice}
            </div>
          ) : null}

          {job.failedCount > 0 && !running ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] px-5 py-3 text-[12.5px] text-[var(--color-ink-2)]">
              {job.failedCount} item(s) failed — often provider rate limits or
              timeouts. Retrying a subset is safe; results are cached.
              <button type="button" onClick={() => void retryFailed()} className="btn btn-quiet btn-sm ml-auto">
                <Icon name="refresh" size={13} />
                Requeue failed
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] px-5 py-3">
            <div className="seg" role="group" aria-label="Filter results">
              {[
                ["", "All"],
                ["DONE", "Resolved"],
                ["FAILED", "Failed"],
                ["SKIPPED", "Skipped"],
                ["PENDING", "Queued"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  data-on={itemFilter === v}
                  onClick={() => setItemFilter(v)}
                >
                  {label}
                </button>
              ))}
            </div>
            {resolvedNoRecord.length > 0 ? (
              <button
                type="button"
                onClick={() => void stageAllResolved()}
                className="btn btn-primary btn-sm ml-auto"
              >
                <Icon name="plus" size={14} />
                Stage {resolvedNoRecord.length} no-record
              </button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <Empty
              title={items.length === 0 ? "No items yet" : "Nothing in this filter"}
              hint={
                items.length === 0
                  ? "Prepare a scan above, then run it to populate results."
                  : "Switch filters to see other items."
              }
              icon="layers"
            />
          ) : (
            <div className="grid-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Item</th>
                    <th>Registry state</th>
                    <th>Provider</th>
                    <th className="num">HTTP</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => {
                    const state = saved[it.fqdn];
                    return (
                      <tr key={it.id}>
                        <td className="mono primary">{it.fqdn}</td>
                        <td>
                          <Badge tone={ITEM_TONE[it.status] ?? "unknown"} dot>
                            {ITEM_LABEL[it.status] ?? it.status}
                          </Badge>
                        </td>
                        <td>
                          {it.normalizedStatus ? (
                            <Badge tone={AVAIL_TONE[it.normalizedStatus] ?? "unknown"}>
                              {it.normalizedStatus.toLowerCase().replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <span className="faint text-[12px]">—</span>
                          )}
                        </td>
                        <td className="mono text-[11.5px]">
                          {it.providerHost ?? "—"}
                        </td>
                        <td className="num">{it.httpStatus ?? "—"}</td>
                        <td className="text-right">
                          {it.normalizedStatus === "NOT_FOUND" ? (
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              disabled={state === "saving" || state === "saved"}
                              onClick={() => void stage(it)}
                            >
                              {state === "saved" ? (
                                <>
                                  <Icon name="check" size={13} /> Staged
                                </>
                              ) : state === "error" ? (
                                "Retry"
                              ) : (
                                <>
                                  <Icon name="plus" size={13} /> Stage
                                </>
                              )}
                            </button>
                          ) : it.status === "FAILED" ? (
                            <span
                              className="micro"
                              title={it.errorDetails ?? it.errorKind ?? undefined}
                            >
                              {it.errorKind ?? "error"}
                            </span>
                          ) : it.status === "SKIPPED" ? (
                            <span className="faint text-[11px]">not attempted</span>
                          ) : (
                            <span className="faint text-[11px]">
                              {it.isFresh ? "definite" : it.status.toLowerCase()}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <Empty
          title="No scan prepared yet"
          hint="Paste names or upload a CSV, choose extensions, then validate. Nothing is sent to a registry until you run the scan."
          icon="layers"
        />
      )}

      <Note>
        A “no record” (NOT_FOUND) result reflects registry state only — it is not
        proof a domain is available for registration. Unsupported extensions are
        skipped, never guessed. Results are stored durably and can be exported at
        any time.
      </Note>
    </div>
  );
}
