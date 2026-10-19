"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Note, Panel, PageHeader } from "@/components/ui";

interface Settings {
  defaultTlds: string[];
  requestBudgetPerRun: number;
  maxConcurrency: number;
  requestDelayMs: number;
  fxRateSource: string;
  theme: string;
  investorNotes: string | null;
}

interface TldRow {
  tld: string;
  status: string;
  displayName?: string;
}

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [original, setOriginal] = useState<string>("");
  const [tlds, setTlds] = useState<TldRow[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/tlds").then((r) => r.json()),
    ])
      .then(([s, t]) => {
        if (cancelled) return;
        const next: Settings = {
          defaultTlds: s.defaultTlds ?? [],
          requestBudgetPerRun: s.requestBudgetPerRun,
          maxConcurrency: s.maxConcurrency,
          requestDelayMs: s.requestDelayMs,
          fxRateSource: s.fxRateSource,
          theme: s.theme,
          investorNotes: s.investorNotes,
        };
        setSettings(next);
        setOriginal(JSON.stringify(next));
        setTlds(t.tlds ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => Boolean(settings) && JSON.stringify(settings) !== original,
    [settings, original],
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
      } else {
        setSaved(true);
        setOriginal(JSON.stringify(settings));
      }
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div>
        <PageHeader eyebrow="System" title="Settings" />
        <div className="space-y-6">
          <div className="skeleton h-40" />
          <div className="skeleton h-56" />
        </div>
      </div>
    );
  }

  const queryable = tlds.filter((t) => t.status === "AVAILABLE");

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Instance settings"
        lead="Controls for this deployment. Budget, concurrency and delay govern how live registry lookups are throttled — they apply to every investigation."
      />

      <form onSubmit={save} className="space-y-6 pb-24">
        <Panel
          icon="registry"
          title="Default extensions"
          note="Pre-selected every time you open Investigate"
          flush={false}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() =>
                  setSettings((p) =>
                    p ? { ...p, defaultTlds: queryable.map((t) => t.tld) } : p,
                  )
                }
              >
                All queryable
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() =>
                  setSettings((p) =>
                    p
                      ? {
                          ...p,
                          defaultTlds: [".com", ".ai", ".io"].filter((c) =>
                            tlds.some((t) => t.tld === c),
                          ),
                        }
                      : p,
                  )
                }
              >
                Core three
              </button>
            </div>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {tlds.map((t) => {
              const on = settings.defaultTlds.includes(t.tld);
              return (
                <button
                  type="button"
                  key={t.tld}
                  onClick={() =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            defaultTlds: on
                              ? prev.defaultTlds.filter((x) => x !== t.tld)
                              : [...prev.defaultTlds, t.tld],
                          }
                        : prev,
                    )
                  }
                  aria-pressed={on}
                  className="chip"
                  title={t.displayName}
                >
                  {t.tld}
                </button>
              );
            })}
          </div>
          <Note>
            {settings.defaultTlds.length} of {tlds.length} extensions selected.{" "}
            {queryable.length} have a verified RDAP endpoint; the rest are recorded as
            unsupported when queried.
          </Note>
        </Panel>

        <Panel
          icon="compass"
          title="Request behaviour"
          note="Applies to every live RDAP lookup"
          flush={false}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Request budget per run"
              hint="1 – 10,000 requests"
              value={settings.requestBudgetPerRun}
              onChange={(v) => setSettings({ ...settings, requestBudgetPerRun: v })}
            />
            <NumberField
              label="Max concurrency"
              hint="1 – 10 parallel requests"
              value={settings.maxConcurrency}
              onChange={(v) => setSettings({ ...settings, maxConcurrency: v })}
            />
            <NumberField
              label="Request delay"
              hint="Milliseconds between requests"
              value={settings.requestDelayMs}
              onChange={(v) => setSettings({ ...settings, requestDelayMs: v })}
            />
            <div>
              <label className="field-label" htmlFor="fx">
                FX rate source <span className="text-[var(--color-ink-4)]">· reserved</span>
              </label>
              <input
                id="fx"
                value={settings.fxRateSource}
                readOnly
                disabled
                className="input opacity-60"
              />
              <p className="micro mt-1.5">
                Stored only. No valuation or currency conversion runs yet, so this
                value is not consumed by any feature.
              </p>
            </div>
          </div>
        </Panel>

        <Panel icon="console" title="Instance notes" flush={false}>
          <textarea
            value={settings.investorNotes ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, investorNotes: e.target.value })
            }
            rows={4}
            className="textarea"
            placeholder="Anything you want stored alongside this instance…"
            aria-label="Instance notes"
          />
        </Panel>

        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-30 border-t border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-canvas)_88%,transparent)] backdrop-blur-md lg:bottom-0">
          <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-6 py-3 lg:px-10">
            <button
              type="submit"
              disabled={!dirty || saving || settings.defaultTlds.length === 0}
              className="btn btn-accent"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saved && !dirty ? (
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--color-ok)]">
                <Icon name="check" size={14} />
                Saved
              </span>
            ) : null}
            {error ? (
              <span className="text-[12px] text-[var(--color-bad)]">{error}</span>
            ) : null}
            {dirty && !error ? (
              <span className="micro ml-auto hidden sm:block">Unsaved changes</span>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input mono"
      />
      {hint ? <p className="micro mt-1.5">{hint}</p> : null}
    </div>
  );
}
