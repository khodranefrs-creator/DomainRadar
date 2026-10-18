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
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-[68ch]">
        {eyebrow ? <div className="eyebrow mb-2.5">{eyebrow}</div> : null}
        <h1 className="page-title">{title}</h1>
        {lead ? <p className="lede mt-3">{lead}</p> : null}
      </div>
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
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--color-line)] text-[var(--color-ink-2)]">
                <Icon name={icon} size={15} />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[13.5px] font-semibold tracking-tight text-[var(--color-ink)]">
                {title}
              </h2>
              {note ? (
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-ink-3)]">
                  {note}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {flush ? children : <div className="p-5">{children}</div>}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="panel relative overflow-hidden px-4 py-4">
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: toneVar(tone) }}
        aria-hidden
      />
      <div className="eyebrow">{label}</div>
      <div className="stat-lg mt-2.5">{value}</div>
      {hint ? (
        <div className="mt-1.5 text-[11.5px] text-[var(--color-ink-3)]">{hint}</div>
      ) : null}
    </div>
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
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  const c = toneVar(tone);
  return (
    <div
      className="rounded-[10px] border px-4 py-3 text-[12.5px] leading-relaxed"
      style={{
        borderColor: `color-mix(in srgb, ${c} 34%, transparent)`,
        background: `color-mix(in srgb, ${c} 10%, transparent)`,
      }}
    >
      {title ? (
        <div
          className="mb-1 flex items-center gap-2 font-semibold"
          style={{ color: c }}
        >
          <Icon name="shield" size={14} />
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

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 max-w-[78ch] text-[11px] leading-relaxed text-[var(--color-ink-4)]">
      {children}
    </p>
  );
}
