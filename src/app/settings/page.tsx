"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-shell";

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
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/tlds").then((r) => r.json()),
    ])
      .then(([s, t]) => {
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
      .catch(() => setError("Failed to load settings"));
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
    return <p className="text-sm text-[var(--color-muted)]">Loading settings…</p>;
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Local configuration. These bounds govern request budgets and pacing for every source adapter."
      />
      <form onSubmit={save} className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-xs text-[var(--color-muted)] mb-2">
            Default extensions for scanning
          </label>
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
                  className={[
                    "px-2.5 py-1 rounded-md text-xs font-mono border",
                    on
                      ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                      : "bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)]",
                  ].join(" ")}
                >
                  {t.tld}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <label className="block text-xs text-[var(--color-muted)] mb-1">
              FX rate source
            </label>
            <input
              value={settings.fxRateSource}
              onChange={(e) => setSettings({ ...settings, fxRateSource: e.target.value })}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--color-muted)] mb-1">
            Investor notes
          </label>
          <textarea
            value={settings.investorNotes ?? ""}
            onChange={(e) => setSettings({ ...settings, investorNotes: e.target.value })}
            rows={4}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={settings.defaultTlds.length === 0}
            className="px-4 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
          >
            Save settings
          </button>
          {saved ? <span className="text-xs text-emerald-400">{saved}</span> : null}
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
      <label className="block text-xs text-[var(--color-muted)] mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm w-full"
      />
    </div>
  );
}
