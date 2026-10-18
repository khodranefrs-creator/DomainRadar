"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const next = new URLSearchParams(window.location.search).get("next");
        const target =
          next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
        window.location.assign(target);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "Login failed.");
      setBusy(false);
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block h-6 w-6 rounded bg-[var(--color-accent)]" />
          <span className="font-semibold tracking-tight text-[15px]">
            Domain Radar
          </span>
        </div>
        <p className="text-xs text-[var(--color-muted)] mb-5 leading-relaxed">
          This instance is protected. Enter the access password to continue.
          You will stay signed in on this browser.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label
            htmlFor="password"
            className="block text-xs text-[var(--color-muted)]"
          >
            Access password
          </label>
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="w-full px-3 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error ? (
          <div className="mt-3 border border-red-600/50 bg-red-500/10 text-red-300 text-xs rounded-md px-3 py-2">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
