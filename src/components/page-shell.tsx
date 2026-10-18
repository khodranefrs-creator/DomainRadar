import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-[var(--color-muted)] mt-1 max-w-3xl">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] px-4 py-3">
      <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint ? (
        <div className="text-xs text-[var(--color-muted)] mt-1">{hint}</div>
      ) : null}
    </div>
  );
}

export function EmptyCard({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-[var(--color-border)] rounded-lg px-6 py-10 text-center">
      <p className="text-sm text-[var(--color-fg)]">{title}</p>
      {hint ? (
        <p className="text-xs text-[var(--color-muted)] mt-2">{hint}</p>
      ) : null}
    </div>
  );
}
