import { PageHeader } from "@/components/page-shell";

export function MilestonePlaceholder({
  title,
  description,
  milestone,
  planned,
}: {
  title: string;
  description: string;
  milestone: string;
  planned: string[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-6 max-w-2xl">
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
          Planned for {milestone}
        </div>
        <p className="text-sm mt-2 text-[var(--color-muted)]">
          Not implemented yet. This page intentionally shows no data rather than
          placeholder metrics.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {planned.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-[var(--color-muted)]">•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
