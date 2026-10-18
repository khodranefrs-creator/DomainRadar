import type { ReactNode } from "react";

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "unknown";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-[var(--color-border)] text-[var(--color-muted)]",
  good: "border-emerald-600/50 text-emerald-400 bg-emerald-500/10",
  warn: "border-amber-600/50 text-amber-400 bg-amber-500/10",
  bad: "border-red-600/50 text-red-400 bg-red-500/10",
  info: "border-blue-600/50 text-blue-400 bg-blue-500/10",
  unknown: "border-zinc-600/50 text-zinc-400 bg-zinc-500/10",
};

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

/** Map a normalized availability status to a badge tone. UNKNOWN is never green. */
export function availabilityTone(status: string): Tone {
  switch (status) {
    case "REGISTERED":
      return "info";
    case "NOT_FOUND":
      return "unknown";
    case "RESERVED":
    case "RESTRICTED":
      return "warn";
    case "UNSUPPORTED":
      return "neutral";
    case "ERROR":
      return "bad";
    case "UNKNOWN":
    default:
      return "unknown";
  }
}

export function tldStatusTone(status: string): Tone {
  switch (status) {
    case "AVAILABLE":
      return "good";
    case "NEEDS_VERIFICATION":
      return "warn";
    case "DISABLED":
      return "bad";
    case "UNSUPPORTED":
      return "unknown";
    default:
      return "neutral";
  }
}
