"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/scanner", label: "Domain Scanner" },
  { href: "/candidates", label: "Candidates" },
  { href: "/sales", label: "Sales & Comps", note: "M3" },
  { href: "/trends", label: "Trends & News", note: "M5" },
  { href: "/buyers", label: "Buyers", note: "M6" },
  { href: "/trademarks", label: "Trademarks", note: "M6" },
  { href: "/portfolio", label: "Portfolio", note: "M8" },
  { href: "/sources", label: "Sources & TLDs" },
  { href: "/settings", label: "Settings" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 hidden md:flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="px-5 py-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-6 w-6 rounded bg-[var(--color-accent)]" />
          <span className="font-semibold tracking-tight text-[15px]">
            Domain Radar
          </span>
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">
          Evidence-first research. Local-first. No invented data.
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Main">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center justify-between mx-2 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-[var(--color-surface-2)] text-[var(--color-fg)] font-medium"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              <span>{item.label}</span>
              {"note" in item && item.note ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-muted)]">
                  {item.note}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-[var(--color-border)] text-[11px] text-[var(--color-muted)]">
        v0.1 · Milestone 1
      </div>
    </aside>
  );
}
