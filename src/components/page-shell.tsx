import type { ReactNode } from "react";

type Tone = "accent" | "ok" | "warn" | "danger" | "info" | "neutral";

const TONE_BAR: Record<Tone, string> = {
  accent: "bg-[var(--color-accent)]",
  ok: "bg-[var(--color-ok)]",
  warn: "bg-[var(--color-warn)]",
  danger: "bg-[var(--color-danger)]",
  info: "bg-[var(--color-info)]",
  neutral: "bg-[var(--color-border-strong)]",
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-7">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--color-fg-strong)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "accent",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="panel relative overflow-hidden px-4 py-4">
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${TONE_BAR[tone]}`}
        aria-hidden
      />
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-[26px] font-semibold tracking-tight tnum text-[var(--color-fg-strong)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>
      ) : null}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  padded = true,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="panel overflow-hidden">
      {title ? (
        <div className="panel-head">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-fg-strong)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function EmptyCard({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--color-border-strong)] rounded-xl px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--color-fg)]">{title}</p>
      {hint ? (
        <p className="max-w-md text-xs text-[var(--color-muted)]">{hint}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
