import type { ReactNode } from "react";

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "unknown";

const TONE_COLOR: Record<Tone, string> = {
  neutral: "var(--color-ink-2)",
  good: "var(--color-ok)",
  warn: "var(--color-warn)",
  bad: "var(--color-bad)",
  info: "var(--color-info)",
  unknown: "var(--color-ink-3)",
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
  const c = TONE_COLOR[tone] ?? TONE_COLOR.neutral;
  return (
    <span
      title={title}
      className="status rounded-md border px-2 py-[3px] text-[11px]"
      style={{
        color: c,
        borderColor: `color-mix(in srgb, ${c} 34%, transparent)`,
        background: `color-mix(in srgb, ${c} 10%, transparent)`,
      }}
    >
      {dot ? <span className="dot" style={{ background: c }} aria-hidden /> : null}
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
