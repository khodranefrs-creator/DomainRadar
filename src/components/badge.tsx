import type { ReactNode } from "react";

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "unknown";

const TONE_CLASS: Record<Tone, string> = {
  neutral:
    "border-[var(--color-border-strong)] text-[var(--color-muted)] bg-[var(--color-surface-2)]",
  good: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  warn: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  bad: "border-red-500/40 text-red-300 bg-red-500/10",
  info: "border-blue-500/40 text-blue-300 bg-blue-500/10",
  unknown:
    "border-zinc-500/40 text-zinc-300 bg-zinc-500/10",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-zinc-400",
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  bad: "bg-red-400",
  info: "bg-blue-400",
  unknown: "bg-zinc-500",
};

export function Badge({
  children,
  tone = "neutral",
  title,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
  dot?: boolean;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CLASS[tone]}`}
    >
      {dot ? (
        <span
          className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`}
          aria-hidden
        />
      ) : null}
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
