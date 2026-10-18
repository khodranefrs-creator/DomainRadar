import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

type Tone =
  | "neutral"
  | "ok"
  | "good"
  | "warn"
  | "bad"
  | "danger"
  | "info"
  | "accent"
  | "unknown";

const TONE: Record<Tone, string> = {
  neutral: "var(--color-ink-3)",
  ok: "var(--color-ok)",
  good: "var(--color-ok)",
  warn: "var(--color-warn)",
  bad: "var(--color-bad)",
  danger: "var(--color-bad)",
  info: "var(--color-info)",
  accent: "var(--color-accent)",
  unknown: "var(--color-ink-3)",
};

function toneVar(tone: Tone) {
  return TONE[tone] ?? TONE.neutral;
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  aside,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-5 border-b border-[var(--color-line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-2.5">{eyebrow}</div> : null}
        <h1 className="page-title">{title}</h1>
        {lead ? <p className="lede mt-3">{lead}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function Panel({
  title,
  note,
  actions,
  icon,
  children,
  flush = true,
  className = "",
}: {
  title?: string;
  note?: string;
  actions?: ReactNode;
  icon?: string;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`panel-flush ${className}`}>
      {title ? (
        <div className="panel-head">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--color-line)] text-[var(--color-ink-3)]">
                <Icon name={icon} size={15} />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="panel-title">{title}</h2>
              {note ? <p className="panel-note">{note}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {flush ? children : <div className="p-5">{children}</div>}
    </section>
  );
}

/** A single dense line of real facts — the replacement for KPI card grids. */
export function StatLine({
  items,
  className = "",
}: {
  items: { label: string; value: ReactNode; tone?: Tone }[];
  className?: string;
}) {
  return (
    <dl className={`statline ${className}`}>
      {items.map((it, i) => (
        <div key={i}>
          <dt>{it.label}</dt>
          <dd style={{ color: it.tone ? toneVar(it.tone) : undefined }}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({
  title,
  hint,
  action,
  icon = "investigate",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={20} />
      </div>
      <p className="text-[13.5px] font-medium text-[var(--color-ink)]">{title}</p>
      {hint ? (
        <p className="max-w-sm text-[12px] leading-relaxed text-[var(--color-ink-3)]">
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}

export function Callout({
  tone = "warn",
  title,
  icon = "shield",
  children,
}: {
  tone?: Tone;
  title?: string;
  icon?: string;
  children: ReactNode;
}) {
  const c = toneVar(tone);
  return (
    <div
      className="rounded-[11px] border px-4 py-3 text-[12.5px] leading-relaxed"
      style={{
        borderColor: `color-mix(in srgb, ${c} 32%, transparent)`,
        background: `color-mix(in srgb, ${c} 9%, transparent)`,
      }}
    >
      {title ? (
        <div className="mb-1 flex items-center gap-2 font-semibold" style={{ color: c }}>
          <Icon name={icon} size={14} />
          {title}
        </div>
      ) : null}
      <div className="text-[var(--color-ink-2)]">{children}</div>
    </div>
  );
}

export function Bar({
  value,
  max,
  tone = "neutral",
}: {
  value: number;
  max: number;
  tone?: Tone;
}) {
  const pct = max <= 0 ? 0 : Math.max(3, Math.min(100, (value / max) * 100));
  return (
    <div className="bar">
      <span style={{ width: `${pct}%`, background: toneVar(tone) }} />
    </div>
  );
}

/** Inline status marker used in tables and lists. */
export function Dot({ tone = "neutral", label }: { tone?: Tone; label: string }) {
  return (
    <span className="status" style={{ color: toneVar(tone) }}>
      <span className="dot" style={{ background: toneVar(tone) }} aria-hidden />
      {label}
    </span>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="micro mt-3 max-w-[78ch] leading-relaxed text-[var(--color-ink-4)]">
      {children}
    </p>
  );
}
