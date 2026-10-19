import type { ReactNode } from "react";

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "unknown" | "accent";

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
    <span className="st" data-tone={tone} title={title}>
      {dot ? <span className="dot" aria-hidden /> : null}
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

