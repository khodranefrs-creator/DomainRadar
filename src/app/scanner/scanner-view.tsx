"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type Method = "core" | "verified" | "all";

const METHOD_LABEL: Record<Method, string> = {
  core: "Core five",
  verified: "All verified",
  all: "Everything",
};

function clean(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\s+/g, "")
    .split(".")[0];
}

type SaveState = "saving" | "saved" | "error";

export function ScannerView() {
  const params = useSearchParams();
  const initialName = clean(params.get("name") ?? "");

  const [name, setName] = useState(initialName);
  const [tlds, setTlds] = useState<TldRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [method, setMethod] = useState<Method>("core");
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, SaveState>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const runSearch = useCallback(async (sld: string, picks: string[]) => {
    if (!sld || picks.length === 0) return;
    setLoading(true);
    setError(null);
    setExpanded(null);
    setSaved({});
    setNotice(null);
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
        const core = data.tlds.filter((t) => CORE.includes(t.tld)).map((t) => t.tld);
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

  const verifiedTlds = tlds.filter((t) => t.status === "AVAILABLE");
  const otherTlds = tlds.filter((t) => t.status !== "AVAILABLE");

  const noRecord = useMemo(
    () => (result?.variants ?? []).filter((v) => v.status === "NOT_FOUND"),
    [result],
  );

  function chooseMethod(m: Method) {
    setMethod(m);
    if (m === "core") setSelected(CORE.filter((c) => tlds.some((t) => t.tld === c)));
    if (m === "verified") setSelected(verifiedTlds.map((t) => t.tld));
    if (m === "all") setSelected(tlds.map((t) => t.tld));
  }

  function toggle(tld: string) {
    setMethod("all");
    setSelected((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld],
    );
  }

  async function stageOne(fqdn: string, detail: string) {
    setSaved((s) => ({ ...s, [fqdn]: "saving" }));
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: fqdn,
          status: "CANDIDATE",
          generationRule: "rdap-investigation",
          notes: `Staged from RDAP investigation · ${detail}`,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved((s) => ({ ...s, [fqdn]: "saved" }));
    } catch {
      setSaved((s) => ({ ...s, [fqdn]: "error" }));
    }
  }

  async function stageAllNoRecord() {
    setNotice(null);
    for (const v of noRecord) {
      if (saved[v.fqdn] === "saved") continue;
      await stageOne(
        v.fqdn,
        [v.status, v.lastCheckedAt ? new Date(v.lastCheckedAt).toISOString() : null]
          .filter(Boolean)
          .join(" · "),
      );
    }
    setNotice(`${noRecord.length} no-record names staged in the pipeline.`);
  }

  function exportCsv() {
    if (!result) return;
    const head = ["domain", "registry_state", "provider", "http_status", "checked_at", "detail"];
    const lines = result.variants.map((v) =>
      [
        v.fqdn,
        v.status,
        v.providerHost ?? v.source ?? "",
        v.httpStatus ?? "",
        v.lastCheckedAt ?? "",
        v.detail,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `domain-radar-${result.sld}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canRun = !loading && selected.length > 0 && name.trim().length > 0;

  return (
    <div className="space-y-5">
      <section className="deck">
        <div className="deck-pad">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <span className="pill-eyebrow">
                <Icon name="investigate" size={13} />
                Live RDAP lookup
              </span>
              <h1 className="display mt-3.5 text-[clamp(1.6rem,3.2vw,2.3rem)]">
                Investigate a name
              </h1>
            </div>
            <p className="max-w-[46ch] text-[13px] leading-relaxed text-[var(--color-deck-ink-2)]">
              The label is checked against each selected extension over RDAP.
              Every row keeps its registry, provider host, HTTP status and raw
              evidence.
            </p>
          </div>

          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(clean(name), selected);
            }}
          >
            <label htmlFor="sld" className="sr-only">
              Second-level domain label
            </label>
            <div className="searchbar">
              <Icon name="search" size={18} />
              <input
                id="sld"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="agentcapability"
                autoComplete="off"
                spellCheck={false}
              />
              <span className="suffix" aria-hidden>
                .***
              </span>
              <button type="submit" className="go" disabled={!canRun}>
                {loading ? (
                  <>
                    <Icon name="refresh" size={16} className="spin" />
                    Checking…
                  </>
                ) : (
                  <>
                    Check {selected.length} extension{selected.length === 1 ? "" : "s"}
                    <Icon name="arrow" size={16} />
                  </>
                )}
              </button>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <div className="seg" role="group" aria-label="Lookup scope">
                {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-on={method === m}
                    onClick={() => chooseMethod(m)}
                  >
                    {METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
              <span className="mono text-[11.5px] text-[var(--color-deck-ink-3)]">
                {selected.length} of {tlds.length} extensions
              </span>
              <button
                type="button"
                className="btn btn-sm ml-auto"
                onClick={() => setShowPicker((v) => !v)}
                aria-expanded={showPicker}
              >
                <Icon name="filter" size={14} />
                {showPicker ? "Hide extensions" : "Choose extensions"}
              </button>
            </div>

            {showPicker ? (
              <div className="mt-4 space-y-4 border-t border-[var(--color-deck-line)] pt-4">
                <div>
                  <div className="eyebrow mb-2">Verified endpoint</div>
                  <div className="flex flex-wrap gap-1.5">
                    {verifiedTlds.map((t) => (
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
                {otherTlds.length > 0 ? (
                  <div>
                    <div className="eyebrow mb-2">No verified endpoint</div>
                    <div className="flex flex-wrap gap-1.5">
                      {otherTlds.map((t) => (
                        <button
                          type="button"
                          key={t.tld}
                          onClick={() => toggle(t.tld)}
                          aria-pressed={selected.includes(t.tld)}
                          className="chip"
                          data-dim="true"
                          title={`${t.displayName} — no verified RDAP endpoint; recorded as unsupported`}
                        >
                          {t.tld}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="micro">
                  Extensions without a verified RDAP endpoint are recorded as
                  unsupported — never guessed.
                </p>
              </div>
            ) : null}
          </form>
        </div>
      </section>

      {error ? (
        <Callout tone="bad" title="Lookup failed" icon="alert">
          {error}
        </Callout>
      ) : null}

      {loading ? (
        <div className="space-y-5">
          <div className="panel-flush">
            <div className="flex items-center gap-2.5 px-5 py-4 text-[13px] text-[var(--color-ink-2)]">
              <Icon name="refresh" size={15} className="spin text-[var(--color-accent)]" />
              Contacting {selected.length} registries over RDAP…
            </div>
            <dl className="statline rounded-none border-0 border-t border-[var(--color-line)]">
              <div><dt>Checked</dt><dd>—</dd></div>
              <div><dt>Registered</dt><dd>—</dd></div>
              <div><dt>No record*</dt><dd>—</dd></div>
            </dl>
          </div>
          <div className="skeleton h-72" />
        </div>
      ) : result ? (
        <div className="space-y-4">
          <section className="panel-flush">
            <div className="panel-head flex-wrap gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="mono text-[19px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
                    {result.sld}
                  </h2>
                  <Badge
                    dot
                    tone={
                      result.status === "COMPLETED"
                        ? "good"
                        : result.status === "FAILED"
                          ? "bad"
                          : "warn"
                    }
                  >
                    {result.status.toLowerCase()}
                  </Badge>
                  {result.registeredCount > 0 ? (
                    <span className="micro">
                      taken in{" "}
                      <b className="text-[var(--color-ink-2)]">
                        {result.registeredCount}
                      </b>{" "}
                      of {result.checkedCount} checked
                    </span>
                  ) : null}
                </div>
                <p className="micro mt-1">{result.note}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={exportCsv} className="btn btn-sm">
                  <Icon name="download" size={14} />
                  CSV
                </button>
                {noRecord.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void stageAllNoRecord()}
                    className="btn btn-primary btn-sm"
                  >
                    <Icon name="plus" size={14} />
                    Stage {noRecord.length} no-record
                  </button>
                ) : null}
              </div>
            </div>

            <dl className="statline rounded-none border-0 border-b border-[var(--color-line)]">
              {[
                ["Requested", result.requestedCount],
                ["Checked", result.checkedCount],
                ["Registered", result.registeredCount],
                ["No record*", result.notFoundCount],
                ["Unsupported", result.unsupportedCount],
                ["Unresolved", result.unresolvedCount],
                ["Errors", result.errorCount],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            {notice ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-ok-soft)] px-5 py-2.5 text-[12.5px] font-medium text-[var(--color-ok)]">
                <Icon name="check" size={14} />
                {notice}
                <Link href="/candidates" className="link ml-auto">
                  Open pipeline →
                </Link>
              </div>
            ) : null}

            <div className="grid-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th className="expand" aria-label="Expand" />
                    <th>Domain</th>
                    <th>Registry state</th>
                    <th>Registry</th>
                    <th className="num">HTTP</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {result.variants.map((v) => {
                    const open = expanded === v.fqdn;
                    const state = saved[v.fqdn];
                    return [
                      <tr
                        key={v.fqdn}
                        onClick={() => setExpanded(open ? null : v.fqdn)}
                        className="cursor-pointer"
                      >
                        <td className="expand">
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-label={open ? `Hide evidence for ${v.fqdn}` : `Show evidence for ${v.fqdn}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded(open ? null : v.fqdn);
                            }}
                            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-line-2)] text-[var(--color-ink-3)] transition-colors hover:border-[var(--color-line-3)] hover:text-[var(--color-ink)] max-sm:h-11 max-sm:w-11"
                          >
                            <Icon
                              name="chevron"
                              size={13}
                              className={open ? "rotate-90 transition-transform" : "transition-transform"}
                            />
                          </button>
                        </td>
                        <td className="dd">{v.fqdn}</td>
                        <td>
                          <Badge tone={STATUS_TONE[v.status] ?? "unknown"} dot>
                            {STATUS_LABEL[v.status] ?? v.status}
                          </Badge>
                        </td>
                        <td className="mono text-[12px]">
                          {v.providerHost ?? v.source ?? "—"}
                        </td>
                        <td className="num">{v.httpStatus ?? "—"}</td>
                        <td className="text-right">
                          {v.status === "NOT_FOUND" ? (
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              disabled={state === "saving" || state === "saved"}
                              onClick={(e) => {
                                e.stopPropagation();
                                void stageOne(
                                  v.fqdn,
                                  [v.status, v.lastCheckedAt].filter(Boolean).join(" · "),
                                );
                              }}
                            >
                              {state === "saved" ? (
                                <>
                                  <Icon name="check" size={13} />
                                  Staged
                                </>
                              ) : state === "error" ? (
                                "Retry"
                              ) : (
                                <>
                                  <Icon name="plus" size={13} />
                                  Stage
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="faint text-[11px]">
                              {v.cached ? "cached" : "live"}
                            </span>
                          )}
                        </td>
                      </tr>,
                      open ? (
                        <tr key={`${v.fqdn}-detail`}>
                          <td colSpan={6} className="row-detail">
                            <div className="row-detail-in">
                              <dl className="kv">
                                <dt>Evidence</dt>
                                <dd>{v.detail}</dd>
                                <dt>Provider host</dt>
                                <dd className="mono">{v.providerHost ?? "—"}</dd>
                                <dt>Source key</dt>
                                <dd className="mono">{v.sourceKey ?? "—"}</dd>
                                <dt>Request</dt>
                                <dd className="mono">
                                  {v.requestUrl ? (
                                    v.requestUrl
                                  ) : (
                                    <span className="faint">
                                      not recorded for this row
                                    </span>
                                  )}
                                </dd>
                                <dt>HTTP status</dt>
                                <dd className="mono">{v.httpStatus ?? "—"}</dd>
                                <dt>Error kind</dt>
                                <dd className="mono">{v.errorKind ?? "none"}</dd>
                                <dt>Checked at</dt>
                                <dd className="mono">
                                  {v.lastCheckedAt
                                    ? new Date(v.lastCheckedAt).toISOString()
                                    : "—"}
                                </dd>
                                <dt>Cache</dt>
                                <dd>{v.cached ? "served from cache" : "fresh request"}</dd>
                              </dl>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <p className="micro max-w-[76ch]">
            * {result.note} A “no record” result is the start of research, not a
            purchase decision.
          </p>
        </div>
      ) : (
        <section className="panel-flush">
          <div className="empty min-h-[300px]">
            <div className="empty-icon">
              <Icon name="investigate" size={21} />
            </div>
            <p className="text-[14px] font-semibold text-[var(--color-ink)]">
              {initialName ? `Nothing returned for “${initialName}”` : "Ready when you are"}
            </p>
            <p className="mt-1.5 max-w-[44ch] text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
              Enter a name above and pick how far to cast the net. Every row keeps
              its registry, HTTP status, request URL and raw response.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
