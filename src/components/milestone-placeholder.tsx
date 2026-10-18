import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/badge";

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
      <PageHeader eyebrow="Planned" title={title} description={description} />
      <div className="panel max-w-3xl p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral" dot>
            {milestone}
          </Badge>
          <span className="text-xs text-[var(--color-muted)]">Not yet built</span>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
          This view is intentionally empty. No placeholder figures, sample charts
          or invented metrics are shown — data appears only once a real, permitted
          source is wired in.
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {planned.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm text-[var(--color-fg)]"
            >
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
