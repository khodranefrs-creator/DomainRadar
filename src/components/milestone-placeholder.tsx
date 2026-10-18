import { Badge } from "@/components/badge";
import { Callout, Note, PageHeader } from "@/components/ui";

export function MilestonePlaceholder({
  title,
  description,
  milestone,
  planned,
  dataNeeds,
}: {
  title: string;
  description: string;
  milestone: string;
  planned: string[];
  dataNeeds?: string[];
}) {
  return (
    <div>
      <PageHeader eyebrow="Roadmap" title={title} lead={description} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="panel-flush">
          <div className="panel-head">
            <div className="flex items-center gap-2.5">
              <Badge tone="neutral" dot>
                {milestone}
              </Badge>
              <span className="text-[11.5px] text-[var(--color-ink-3)]">
                Not yet built
              </span>
            </div>
          </div>
          <div className="p-5">
            <div className="eyebrow mb-3">Planned capabilities</div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {planned.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-bg-2)] px-3.5 py-3 text-[12.5px] text-[var(--color-ink-2)]"
                >
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="space-y-4">
          <Callout tone="warn" title="No placeholder data">
            This view is intentionally empty. No sample figures, illustrative
            charts or invented metrics are shown. It will populate only once a
            real, permitted source is wired in and verified.
          </Callout>

          {dataNeeds && dataNeeds.length > 0 ? (
            <div className="panel p-5">
              <div className="eyebrow mb-3">Prerequisites</div>
              <ul className="space-y-2.5">
                {dataNeeds.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-[12px] leading-relaxed text-[var(--color-ink-2)]"
                  >
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-ink-4)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <Note>
        Roadmap modules ship behind the same evidence rules as the rest of Domain
        Radar: every value is traceable to a permitted source and nothing is
        fabricated to fill the screen.
      </Note>
    </div>
  );
}
