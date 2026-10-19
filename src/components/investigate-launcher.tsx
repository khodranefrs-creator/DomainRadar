"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";

function clean(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\s+/g, "")
    .split(".")[0];
}

/**
 * The product's primary action. One input, one suffix (the extension the SLD
 * is checked against), one button — matching the immediate clarity of a domain
 * search tool while staying honest about what the tool actually does.
 */
export function InvestigateLauncher({
  placeholder = "agentcapability",
  cta = "Check availability",
  suggestions = ["agentcapability", "openai", "stripe", "northwind"],
  hint = true,
}: {
  placeholder?: string;
  cta?: string;
  suggestions?: string[];
  hint?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");

  const go = (value?: string) => {
    const sld = clean(value ?? name);
    if (!sld) return;
    router.push(`/scanner?name=${encodeURIComponent(sld)}`);
  };

  return (
    <div>
      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <Icon name="search" size={18} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-label="Second-level domain label to investigate"
        />
        <span className="suffix" title="Checked against your default extensions">
          .com
        </span>
        <button type="submit" className="go" disabled={!name.trim()}>
          {cta}
          <Icon name="arrow" size={16} />
        </button>
      </form>

      {suggestions.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="micro">Quick checks</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              onClick={() => go(s)}
              title={`Investigate ${s}`}
            >
              {s}
            </button>
          ))}
          {hint ? (
            <span className="micro ml-auto hidden items-center gap-1.5 sm:inline-flex">
              <span className="kbd">⌘K</span>
              command menu
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
