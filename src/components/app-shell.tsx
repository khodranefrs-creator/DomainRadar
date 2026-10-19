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
      { href: "/", label: "Console", icon: "console", hint: "Launch & overview" },
      { href: "/scanner", label: "Investigate", icon: "investigate", hint: "Live RDAP lookup" },
      { href: "/candidates", label: "Pipeline", icon: "pipeline", hint: "Candidate domains" },
      { href: "/experiments", label: "Experiments", icon: "experiments", note: "M7" },
    ],
  },
  {
    label: "Market",
    items: [
      { href: "/sales", label: "Sales & comps", icon: "sales", note: "M3" },
      { href: "/trends", label: "Trends & news", icon: "trends", note: "M5" },
      { href: "/buyers", label: "Buyers", icon: "buyers", note: "M6" },
      { href: "/trademarks", label: "Trademarks", icon: "trademarks", note: "M6" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/portfolio", label: "Portfolio", icon: "portfolio", note: "M4" },
      { href: "/sources", label: "Registry", icon: "registry", hint: "Extensions & sources" },
      { href: "/settings", label: "Settings", icon: "settings", hint: "Defaults & limits" },
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

function matchRoute(pathname: string) {
  if (pathname === "/") return { item: ALL[0], group: "Research" };
  const found = ALL.filter((i) => i.href !== "/" && pathname.startsWith(i.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  if (!found) return { item: null, group: "Research" };
  const group = GROUPS.find((g) => g.items.includes(found))?.label ?? "Research";
  return { item: found, group };
}

/* ---------------------------------------------------------------- palette */

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const items: { key: string; label: string; sub: string; icon: string; go: () => void }[] = [];
    const seen = new Set<string>();
    const push = (i: (typeof items)[number]) => {
      if (seen.has(i.key)) return;
      seen.add(i.key);
      items.push(i);
    };

    if (term && /^[a-z0-9-]{2,}$/i.test(term)) {
      push({
        key: "investigate",
        label: `Investigate “${q.trim()}”`,
        sub: "Live RDAP check across your default extensions",
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
      push({
        key: item.href,
        label: item.label,
        sub: item.hint ?? (item.note ? `Planned · ${item.note}` : "Go to page"),
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
            placeholder="Search a domain, or jump to a surface…"
            className="h-14 flex-1 border-0 bg-transparent font-mono text-[15px] text-[var(--color-ink)] outline-none placeholder:font-sans placeholder:text-[var(--color-ink-4)]"
            spellCheck={false}
            autoComplete="off"
            aria-label="Command input"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-ink-3)]">
              Nothing matches that.
            </p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.key}
                type="button"
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={r.go}
                className="palette-item"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[var(--color-surface-2)] text-[var(--color-ink-2)]">
                  <Icon name={r.icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.label}</span>
                  <span className="block truncate text-[12px] text-[var(--color-ink-3)]">
                    {r.sub}
                  </span>
                </span>
                <Icon
                  name="arrow"
                  size={15}
                  className="ml-auto shrink-0 text-[var(--color-ink-4)]"
                />
              </button>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-2.5 text-[11.5px] text-[var(--color-ink-3)]">
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> move
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↵</span> open
          </span>
          <span className="ml-auto font-medium">Domain Radar</span>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- shell */

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const route = matchRoute(pathname);

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
        setMoreOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    function onPointer(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-more-root]")) return;
      setMoreOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [moreOpen]);

  useEffect(() => {
    const open = paletteOpen || sheetOpen;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [paletteOpen, sheetOpen]);

  const planned = GROUPS[1].items.concat(GROUPS[2].items.filter((i) => i.note));

  return (
    <div className="app">
      <header className="nav">
        <div className="nav-in">
          <Link href="/" className="brand" aria-label="Domain Radar — home">
            <BrandMark size={26} />
            <span className="brand-name">
              Domain<span>Radar</span>
            </span>
          </Link>

          <nav className="nav-links" aria-label="Primary">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                data-active={pathname === t.href}
                className="nav-link"
              >
                {t.label}
              </Link>
            ))}
            <div className="relative hidden lg:block" data-more-root>
              <button
                type="button"
                className="nav-link"
                data-active={planned.some((i) => pathname.startsWith(i.href))}
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                More
                <Icon name="expand" size={13} />
              </button>
              {moreOpen ? (
                <div className="absolute left-0 top-[42px] z-50 w-[248px] rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-lg)]">
                  {planned.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="palette-item"
                      onClick={() => setMoreOpen(false)}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-ink-2)]">
                        <Icon name={item.icon} size={15} />
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                      <span className="ml-auto font-mono text-[10.5px] text-[var(--color-ink-4)]">
                        {item.note}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </nav>

          <div className="nav-side">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-full border border-[var(--color-deck-line)] bg-[color-mix(in_srgb,var(--color-deck-ink)_7%,transparent)] pl-3 pr-2 text-[12.5px] text-[var(--color-deck-ink-2)] transition-colors hover:text-[var(--color-deck-ink)] lg:flex"
              aria-label="Open command menu"
            >
              <Icon name="search" size={15} />
              <span className="w-[132px] text-left">Search or investigate</span>
              <span className="kbd">⌘K</span>
            </button>

            <Link
              href="/settings"
              aria-label="Settings"
              className="icon-btn hidden lg:inline-flex"
            >
              <Icon name="settings" size={16} />
            </Link>

            <Link href="/scanner" className="btn btn-accent btn-sm">
              <Icon name="investigate" size={15} />
              <span className="max-sm:hidden">New lookup</span>
              <span className="sm:hidden">Lookup</span>
            </Link>

            <button
              type="button"
              className="icon-btn lg:hidden"
              onClick={() => setSheetOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="main" id="content">
        {children}
      </main>

      <footer className="foot">
        <div className="foot-in">
          <span className="inline-flex items-center gap-2 font-medium text-[var(--color-ink-2)]">
            <span className="relative flex h-1.5 w-1.5 text-[var(--color-ok)]">
              <span className="ping absolute inline-flex h-1.5 w-1.5 rounded-full" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-ok)]" />
            </span>
            RDAP registry live — evidence first
          </span>
          <span aria-hidden className="text-[var(--color-line-3)]">·</span>
          <span>A “no record” answer never means “available”.</span>
          <span className="ml-auto font-mono text-[11px] text-[var(--color-ink-4)]">
            {route.item ? `${route.group} / ${route.item.label}` : "Off the map"}
          </span>
        </div>
      </footer>

      {sheetOpen ? (
        <>
          <div className="scrim" onClick={() => setSheetOpen(false)} aria-hidden />
          <div className="sheet lg:hidden" role="dialog" aria-modal="true" aria-label="More">
            <div className="sheet-grip" />
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                setPaletteOpen(true);
              }}
              className="mb-2 flex w-full items-center gap-3 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3.5 text-left text-[13.5px] font-medium text-[var(--color-ink-2)]"
            >
              <Icon name="search" size={17} />
              Search or investigate a domain
            </button>
            {GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-2.5 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-4)]">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={pathname === item.href}
                    className="palette-item"
                    onClick={() => setSheetOpen(false)}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[var(--color-surface-2)] text-[var(--color-ink-2)]">
                      <Icon name={item.icon} size={16} />
                    </span>
                    <span className="truncate font-medium">{item.label}</span>
                    {item.note ? (
                      <span className="ml-auto font-mono text-[10.5px] text-[var(--color-ink-4)]">
                        {item.note}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} data-active={pathname === t.href} className="tab">
            <Icon name={t.icon} size={19} />
            {t.label}
          </Link>
        ))}
        <button type="button" className="tab" onClick={() => setSheetOpen(true)}>
          <Icon name="menu" size={19} />
          More
        </button>
      </nav>

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
