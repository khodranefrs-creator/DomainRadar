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

export function InvestigateLauncher({
  placeholder = "agentcapability",
  cta = "Investigate",
  suggestions = ["agentcapability", "openai", "stripe"],
  hint = true,
}: {
  placeholder?: string;
  cta?: string;
  suggestions?: string[];
  hint?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");

  return (
    <div>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          const sld = clean(name);
          if (!sld) return;
          router.push(`/scanner?name=${encodeURIComponent(sld)}`);
        }}
      >
        <Icon
          name="investigate"
          size={19}
          className="shrink-0 text-[var(--color-accent)]"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-label="Second-level domain label to investigate"
        />
        <button type="submit" className="btn btn-accent btn-lg" disabled={!name.trim()}>
          {cta}
          <Icon name="arrow" size={16} />
        </button>
      </form>

      {suggestions.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="micro">Try</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              onClick={() => setName(s)}
            >
              {s}
            </button>
          ))}
          {hint ? (
            <span className="micro ml-auto hidden items-center gap-1.5 sm:inline-flex">
              <span className="kbd">⌘K</span> command menu
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
