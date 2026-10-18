"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrandMark, Icon } from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  note?: string;
  hint?: string;
};

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Research",
    items: [
      { href: "/", label: "Console", icon: "console", hint: "Overview & launch" },
      { href: "/scanner", label: "Investigate", icon: "investigate", hint: "Live RDAP lookup" },
      { href: "/candidates", label: "Pipeline", icon: "pipeline", hint: "Candidate domains" },
      { href: "/experiments", label: "Experiments", icon: "experiments", note: "M7" },
    ],
  },
  {
    label: "Market",
    items: [
      { href: "/sales", label: "Sales & Comps", icon: "sales", note: "M3" },
      { href: "/trends", label: "Trends & News", icon: "trends", note: "M5" },
      { href: "/buyers", label: "Buyers", icon: "buyers", note: "M6" },
      { href: "/trademarks", label: "Trademarks", icon: "trademarks", note: "M6" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/portfolio", label: "Portfolio", icon: "portfolio", note: "M4" },
      { href: "/sources", label: "Registry", icon: "registry", hint: "Extensions & sources" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

const ALL: NavItem[] = GROUPS.flatMap((g) => g.items);

const TABS: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Console", icon: "console" },
  { href: "/scanner", label: "Investigate", icon: "investigate" },
  { href: "/candidates", label: "Pipeline", icon: "pipeline" },
  { href: "/sources", label: "Registry", icon: "registry" },
];

/* ---------------------------------------------------------------- palette */

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const items: { key: string; label: string; sub: string; icon: string; go: () => void }[] = [];
    const looksLikeName = /^[a-z0-9-]{2,}$/i.test(term);
    if (looksLikeName) {
      items.push({
        key: "investigate",
        label: `Investigate “${q.trim()}”`,
        sub: "Run a live RDAP lookup across your default extensions",
        icon: "investigate",
        go: () => {
          router.push(`/scanner?name=${encodeURIComponent(q.trim())}`);
          onClose();
        },
      });
    }
    for (const item of ALL) {
      if (
        term &&
        !item.label.toLowerCase().includes(term) &&
        !(item.hint ?? "").toLowerCase().includes(term) &&
        !item.href.toLowerCase().includes(term)
      ) {
        continue;
      }
      items.push({
        key: item.href,
        label: item.label,
        sub: item.hint ?? (item.note ? `Planned · ${item.note}` : item.href),
        icon: item.icon,
        go: () => {
          router.push(item.href);
          onClose();
        },
      });
    }
    return items;
  }, [q, router, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[active]?.go();
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command menu">
        <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-4">
          <Icon name="search" size={17} className="shrink-0 text-[var(--color-ink-3)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages or a domain to investigate…"
            className="h-14 flex-1 border-0 bg-transparent text-[15px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-4)]"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-ink-3)]">
              No matches.
            </p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.key}
                type="button"
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={r.go}
                className="palette-item rounded-lg"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)]">
                  <Icon name={r.icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{r.label}</span>
                  <span className="block truncate text-[11.5px] text-[var(--color-ink-3)]">
                    {r.sub}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "/" && !typing && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setSheetOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  useEffect(() => {
    const open = paletteOpen || sheetOpen;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [paletteOpen, sheetOpen]);

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-brand">
          <BrandMark size={26} />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-tight tracking-tight">
              Domain Radar
            </div>
            <div className="text-[11px] text-[var(--color-ink-3)]">
              Domain intelligence
            </div>
          </div>
        </div>
        <nav className="rail-nav">
            {GROUPS.map((group) => (
              <div key={group.label} className="mt-2">
                <div className="mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-4)]">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    data-active={pathname === item.href}
                    className="rail-link"
                  >
                    <Icon name={item.icon} size={17} />
                    <span className="truncate">{item.label}</span>
                    {item.note ? <span className="rail-note">{item.note}</span> : null}
                  </Link>
                ))}
              </div>
            ))}
        </nav>
        <div className="rail-foot">
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-ink-3)]">
            <span className="relative flex h-2 w-2 text-[var(--color-accent)]">
              <span className="ping absolute inline-flex h-2 w-2 rounded-full" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            </span>
            RDAP availability · live
          </div>
        </div>
      </aside>

      <div className="app-col">
        <header className="topbar">
          <div className="flex items-center gap-3 md:hidden">
            <BrandMark size={24} />
            <span className="text-[13.5px] font-semibold tracking-tight">Domain Radar</span>
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="searchbar-btn hidden w-full max-w-md md:flex"
          >
            <Icon name="search" size={16} />
            <span>Search pages or investigate a domain…</span>
            <span className="kbd ml-auto">⌘K</span>
          </button>

          <div className="md:ml-auto">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="icon-btn md:hidden"
              aria-label="Search"
            >
              <Icon name="search" size={18} />
            </button>
          </div>

          <Link
            href="/sources"
            className="hidden items-center gap-2 text-[12.5px] text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)] md:flex"
          >
            <Icon name="registry" size={15} />
            Registry
          </Link>
        </header>

        <main className="app-main">{children}</main>

        <footer className="border-t border-[var(--color-line)] px-6 py-5 text-[11.5px] leading-relaxed text-[var(--color-ink-3)] md:px-10">
          Domain Radar · evidence-first domain intelligence · an unverified lookup is
          never presented as available · nothing is invented
        </footer>
      </div>

      <nav className="tabbar" aria-label="Primary">
        {TABS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-active={pathname === item.href}
            className="tab"
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </Link>
        ))}
        <button type="button" className="tab" onClick={() => setSheetOpen(true)}>
          <Icon name="menu" size={20} />
          More
        </button>
      </nav>

      {sheetOpen ? (
        <>
          <div className="scrim" onClick={() => setSheetOpen(false)} aria-hidden />
          <div className="sheet md:hidden" role="dialog" aria-modal="true" aria-label="More">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--color-line-2)]" />
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                setPaletteOpen(true);
              }}
              className="mb-2 flex w-full items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3 text-left text-[var(--color-ink-2)]"
            >
              <Icon name="search" size={17} />
              Search or investigate a domain
            </button>
            {GROUPS.map((group) => (
              <div key={group.label} className="mt-2">
                <div className="px-2 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-4)]">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={pathname === item.href}
                    className="rail-link"
                  >
                    <Icon name={item.icon} size={17} />
                    <span className="truncate">{item.label}</span>
                    {item.note ? <span className="rail-note">{item.note}</span> : null}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
