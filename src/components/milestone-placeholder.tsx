import Link from "next/link";
import { Badge } from "@/components/badge";
import { Icon } from "@/components/icons";
import { Callout, Note, PageHeader } from "@/components/ui";

const DEFAULT_LINKS: { href: string; label: string; icon: string }[] = [
  { href: "/scanner", label: "Investigate a domain", icon: "investigate" },
  { href: "/bulk", label: "Run a bulk scan", icon: "layers" },
  { href: "/candidates", label: "Review the pipeline", icon: "pipeline" },
  { href: "/sources", label: "Check sources & extensions", icon: "registry" },
];

export function MilestonePlaceholder({
  title,
  description,
  milestone,
  planned,
  dataNeeds,
  links = DEFAULT_LINKS,
}: {
  title: string;
  description: string;
  milestone: string;
  planned: string[];
  dataNeeds?: string[];
  links?: { href: string; label: string; icon: string }[];
}) {
  return (
    <div>
      <PageHeader eyebrow="Roadmap" title={title} lead={description} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="panel-flush h-fit">
          <div className="panel-head">
            <div className="min-w-0">
              <h2 className="panel-title">
                <Icon name="layers" size={15} />
                Planned capabilities
              </h2>
              <p className="panel-note">{milestone} work, not yet built</p>
            </div>
            <Badge tone="neutral" dot>
              Planned
            </Badge>
          </div>
          <ol>
            {planned.map((item, i) => (
              <li
                key={item}
                className="flex gap-3.5 border-b border-[var(--color-line)] px-5 py-4 last:border-0"
              >
                <span className="mono shrink-0 pt-[1px] text-[11px] text-[var(--color-ink-4)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[12.5px] leading-relaxed text-[var(--color-ink-2)]">
                  {item}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-5">
          <Callout tone="warn" title="No placeholder data" icon="alert">
            This surface is intentionally empty. No sample figures, illustrative
            charts or invented metrics appear here — it fills only once a real,
            permitted source is wired in and verified.
          </Callout>

          {dataNeeds && dataNeeds.length > 0 ? (
            <div className="panel p-5">
              <div className="pill-eyebrow mb-3">Prerequisites</div>
              <ul className="space-y-3">
                {dataNeeds.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2.5 text-[12px] leading-relaxed text-[var(--color-ink-2)]"
                  >
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-ink-4)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="panel p-3">
            <div className="pill-eyebrow px-2 pt-1 pb-2">Available now</div>
            <ul>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="link-row">
                    <Icon name={l.icon} size={16} />
                    <span className="truncate text-[12.5px]">{l.label}</span>
                    <Icon
                      name="arrow"
                      size={14}
                      className="ml-auto text-[var(--color-ink-4)]"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Note>
        Roadmap modules ship behind the same evidence rules as the rest of Domain
        Radar: every value is traceable to a permitted source, and nothing is
        fabricated to fill a screen.
      </Note>
    </div>
  );
}
