"use client";

import { useEffect, useState } from "react";
import { PageHeader, Section } from "@/components/page-shell";

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
        <div className="panel h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Local configuration. These bounds govern request budgets and pacing for every source adapter."
      />
      <form onSubmit={save} className="space-y-6">
        <Section
          title="Default extensions"
          description="Pre-selected in the scanner when no extensions are chosen."
        >
          <div className="flex flex-wrap gap-2">
            {tlds.map((t) => {
              const on = settings.defaultTlds.includes(t.tld);
              return (
                <button
                  type="button"
                  key={t.tld}
                  onClick={() =>
                    setSettings((s) =>
                      s
                        ? {
                            ...s,
                            defaultTlds: on
                              ? s.defaultTlds.filter((x) => x !== t.tld)
                              : [...s.defaultTlds, t.tld],
                          }
                        : s,
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
        </Section>

        <Section
          title="Request budget & pacing"
          description="Applied to every outbound registry request."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Request budget per run"
              value={settings.requestBudgetPerRun}
              onChange={(v) => setSettings({ ...settings, requestBudgetPerRun: v })}
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
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                FX rate source
              </label>
              <input
                value={settings.fxRateSource}
                onChange={(e) =>
                  setSettings({ ...settings, fxRateSource: e.target.value })
                }
                className="input"
              />
            </div>
          </div>
        </Section>

        <Section title="Investor notes">
          <textarea
            value={settings.investorNotes ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, investorNotes: e.target.value })
            }
            rows={4}
            className="textarea"
            placeholder="Notes stored with this instance…"
          />
        </Section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={settings.defaultTlds.length === 0}
            className="btn btn-primary"
          >
            Save settings
          </button>
          {saved ? (
            <span className="text-xs text-emerald-400">{saved}</span>
          ) : null}
          {error ? <span className="text-xs text-red-400">{error}</span> : null}
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
      <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input tnum"
      />
    </div>
  );
}
