"use client";

import { useEffect, useState } from "react";
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
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tlds, setTlds] = useState<TldRow[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/tlds").then((r) => r.json()),
    ])
      .then(([s, t]) => {
        if (cancelled) return;
        setSettings({
          defaultTlds: s.defaultTlds ?? [],
          requestBudgetPerRun: s.requestBudgetPerRun,
          maxConcurrency: s.maxConcurrency,
          requestDelayMs: s.requestDelayMs,
          fxRateSource: s.fxRateSource,
          theme: s.theme,
          investorNotes: s.investorNotes,
        });
        setTlds(t.tlds ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load settings");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaved(null);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed");
    } else {
      setSaved("Settings saved");
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

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings"
        lead="Instance-level controls for this deployment. Request budget, concurrency and delay govern how live registry lookups are throttled."
      />

      <form onSubmit={save} className="space-y-6">
        <Panel
          icon="registry"
          title="Default extensions"
          note="Pre-selected whenever you open Investigate"
          flush={false}
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
                >
                  {t.tld}
                </button>
              );
            })}
          </div>
          <Note>
            {settings.defaultTlds.length} of {tlds.length} extensions selected.
            Extensions without a verified RDAP endpoint are marked with an
            asterisk in Investigate.
          </Note>
        </Panel>

        <Panel
          icon="spark"
          title="Request behaviour"
          note="Applies to every live RDAP lookup"
          flush={false}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Request budget per run"
              value={settings.requestBudgetPerRun}
              onChange={(v) =>
                setSettings({ ...settings, requestBudgetPerRun: v })
              }
            />
            <NumberField
              label="Max concurrency"
              value={settings.maxConcurrency}
              onChange={(v) => setSettings({ ...settings, maxConcurrency: v })}
            />
            <NumberField
              label="Request delay (ms)"
              value={settings.requestDelayMs}
              onChange={(v) => setSettings({ ...settings, requestDelayMs: v })}
            />
            <div>
              <label className="field-label">FX rate source</label>
              <input
                value={settings.fxRateSource}
                onChange={(e) =>
                  setSettings({ ...settings, fxRateSource: e.target.value })
                }
                className="input"
              />
            </div>
          </div>
        </Panel>

        <Panel icon="console" title="Investor notes" flush={false}>
          <textarea
            value={settings.investorNotes ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, investorNotes: e.target.value })
            }
            rows={4}
            className="textarea"
            placeholder="Notes stored with this instance…"
          />
        </Panel>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={settings.defaultTlds.length === 0}
            className="btn btn-primary"
          >
            Save settings
          </button>
          {saved ? (
            <span className="text-[11.5px] text-[var(--color-ok)]">{saved}</span>
          ) : null}
          {error ? (
            <span className="text-[11.5px] text-[var(--color-bad)]">{error}</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
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
    </div>
  );
}
