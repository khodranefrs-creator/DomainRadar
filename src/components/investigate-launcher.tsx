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
}: {
  placeholder?: string;
  cta?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");

  return (
    <form
      className="command"
      onSubmit={(e) => {
        e.preventDefault();
        const sld = clean(name);
        if (!sld) return;
        router.push(`/scanner?name=${encodeURIComponent(sld)}`);
      }}
    >
      <Icon name="investigate" size={18} className="shrink-0 text-[var(--color-ink-3)]" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-label="Second-level domain label"
      />
      <button type="submit" className="btn btn-primary btn-lg" disabled={!name.trim()}>
        {cta}
      </button>
    </form>
  );
}
