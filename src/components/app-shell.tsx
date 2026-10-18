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

function matchRoute(pathname: string) {
  if (pathname === "/") return { group: "Research", item: ALL[0] };
  const found = ALL.filter((i) => i.href !== "/" && pathname.startsWith(i.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  if (!found) return { group: "Research", item: { href: pathname, label: "Not found", icon: "compass" } };
  const group = GROUPS.find((g) => g.items.includes(found))?.label ?? "Research";
  return { group, item: found };
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
    const pushes: string[] = [];
    const push = (i: (typeof items)[number]) => {
      if (pushes.includes(i.key)) return;
      pushes.push(i.key);
      items.push(i);
    };

    if (term && /^[a-z0-9-]{2,}$/i.test(term)) {
      push({
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
      push({
        key: item.href,
        label: item.label,
        sub: item.hint ?? (item.note ? `Planned · ${item.note}` : "Jump to page"),
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
            placeholder="Investigate a domain, or jump to a page…"
            className="h-14 flex-1 border-0 bg-transparent font-mono text-[14.5px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-4)]"
            spellCheck={false}
            autoComplete="off"
            aria-label="Command input"
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
                className="palette-item"
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
                <Icon
                  name="arrow"
                  size={15}
                  className="ml-auto shrink-0 text-[var(--color-ink-4)]"
                />
              </button>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-[var(--color-line)] px-4 py-2.5 text-[11px] text-[var(--color-ink-4)]">
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↵</span> open
          </span>
          <span className="ml-auto">Domain Radar</span>
        </div>
      </div>
    </>
  );
}

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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
    <div className="shell">
      <aside className="rail max-lg:hidden">
        <div className="rail-brand">
          <BrandMark size={30} />
          <div className="min-w-0">
            <div className="rail-word">
              Domain Radar
              <small>Intelligence desk</small>
            </div>
          </div>
        </div>

        <nav className="rail-nav" aria-label="Sections">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="rail-group">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={pathname === item.href}
                  className="nl"
                >
                  <Icon name={item.icon} size={17} />
                  <span className="truncate">{item.label}</span>
                  {item.note ? <span className="nl-note">{item.note}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="flex items-center gap-2 text-[11.5px] text-[var(--color-ink-3)]">
            <span className="relative flex h-1.5 w-1.5 text-[var(--color-accent)]">
              <span className="ping absolute inline-flex h-1.5 w-1.5 rounded-full" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
            </span>
            RDAP availability · live
          </div>
          <p className="micro mt-2 max-w-[26ch]">
            Unverified lookups are never reported as available.
          </p>
        </div>
      </aside>

      <div className="shell-col">
        <header className="topbar">
          <div className="flex items-center gap-2.5 lg:hidden">
            <BrandMark size={26} />
            <span className="font-display text-[15px] tracking-tight">Domain Radar</span>
          </div>

          <div className="crumb max-lg:hidden">
            <span>{route.group}</span>
            <Icon name="chevron" size={13} className="text-[var(--color-ink-4)]" />
            <b>{route.item.label}</b>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="cmd-btn hidden lg:flex"
              aria-label="Open command menu"
            >
              <Icon name="search" size={15} />
              <span className="w-[210px] text-left">Search or investigate…</span>
              <span className="kbd">⌘K</span>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="icon-btn lg:hidden"
              aria-label="Search or investigate"
            >
              <Icon name="search" size={18} />
            </button>
            <Link
              href="/scanner"
              className="btn btn-accent btn-sm max-sm:hidden"
              aria-label="Start an investigation"
            >
              <Icon name="investigate" size={15} />
              Investigate
            </Link>
          </div>
        </header>

        <main className="main" id="content">
          <div className="main-narrow">{children}</div>
        </main>

        <footer className="border-t border-[var(--color-line)] px-6 py-5 text-[11.5px] leading-relaxed text-[var(--color-ink-4)] lg:px-10">
          <div className="main-narrow flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[var(--color-ink-3)]">Domain Radar</span>
            <span aria-hidden>·</span>
            <span>Evidence-first domain intelligence</span>
            <span aria-hidden>·</span>
            <span>Nothing invented; uncertainty is stated</span>
          </div>
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
            <Icon name={item.icon} size={19} />
            {item.label}
          </Link>
        ))}
        <button type="button" className="tab" onClick={() => setSheetOpen(true)}>
          <Icon name="menu" size={19} />
          More
        </button>
      </nav>

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
              className="mb-2 flex w-full items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3 text-left text-[13px] text-[var(--color-ink-2)]"
            >
              <Icon name="search" size={17} />
              Search or investigate a domain
            </button>
            {GROUPS.map((group) => (
              <div key={group.label}>
                <div className="rail-group">{group.label}</div>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={pathname === item.href}
                    className="nl"
                    onClick={() => setSheetOpen(false)}
                  >
                    <Icon name={item.icon} size={17} />
                    <span className="truncate">{item.label}</span>
                    {item.note ? <span className="nl-note">{item.note}</span> : null}
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
