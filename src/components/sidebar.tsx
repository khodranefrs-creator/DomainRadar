"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICONS = {
  grid: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  ),
  radar: (
    <Icon>
      <path d="M12 12 19 5" />
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M17 12a5 5 0 1 1-5-5" />
      <circle cx="12" cy="12" r="1" />
    </Icon>
  ),
  list: (
    <Icon>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </Icon>
  ),
  tag: (
    <Icon>
      <path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0L3 13.3V3h10.3l6.7 6.7a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </Icon>
  ),
  trend: (
    <Icon>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </Icon>
  ),
  users: (
    <Icon>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" />
      <path d="M17 14.5a5.5 5.5 0 0 1 3.5 5.5" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
  briefcase: (
    <Icon>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </Icon>
  ),
  database: (
    <Icon>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </Icon>
  ),
} as const;

type NavItem = {
  href: string;
  label: string;
  note?: string;
  icon: keyof typeof ICONS;
};

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Research",
    items: [
      { href: "/", label: "Dashboard", icon: "grid" },
      { href: "/scanner", label: "Scanner", icon: "radar" },
      { href: "/candidates", label: "Candidates", icon: "list" },
    ],
  },
  {
    label: "Market",
    items: [
      { href: "/sales", label: "Sales & Comps", note: "M3", icon: "tag" },
      { href: "/trends", label: "Trends & News", note: "M5", icon: "trend" },
      { href: "/buyers", label: "Buyers", note: "M6", icon: "users" },
      { href: "/trademarks", label: "Trademarks", note: "M6", icon: "shield" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/portfolio", label: "Portfolio", note: "M8", icon: "briefcase" },
      { href: "/sources", label: "Sources & TLDs", icon: "database" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] shadow-[0_2px_10px_rgba(91,140,255,0.35)]">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-white/90" />
        <span className="absolute h-1 w-1 rounded-full bg-white" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-[var(--color-fg-strong)]">
        Domain Radar
      </span>
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)] md:flex">
      <div className="px-5 py-5">
        <Logo />
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted)]">
          Evidence-first domain intelligence. Nothing is invented.
        </p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="eyebrow px-3 pb-2">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-fg-strong)]"
                        : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]",
                    ].join(" ")}
                  >
                    <span
                      className={
                        active
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-faint)] group-hover:text-[var(--color-muted)]"
                      }
                    >
                      {ICONS[item.icon]}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.note ? (
                      <span className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-faint)]">
                        {item.note}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-[var(--color-border)] px-5 py-4 text-[11px] leading-relaxed text-[var(--color-faint)]">
        <div className="text-[var(--color-muted)]">v0.1 · Milestone 2</div>
        <div>Open access · RDAP-backed</div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const items = GROUPS.flatMap((g) => g.items);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Logo />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-fg-strong)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
