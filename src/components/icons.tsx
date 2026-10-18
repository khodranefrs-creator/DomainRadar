import type { SVGProps } from "react";

const PATHS: Record<string, string[]> = {
  console: ["M4 5h16v11H4z", "M4 9h16", "M8 13h5"],
  investigate: [
    "M12 12 19 5",
    "M21 12a9 9 0 1 1-9-9",
    "M17 12a5 5 0 1 1-5-5",
  ],
  pipeline: ["M8 6h13", "M8 12h13", "M8 18h13", "M3.5 6h.01", "M3.5 12h.01", "M3.5 18h.01"],
  registry: [
    "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z",
    "M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6",
    "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  ],
  settings: [
    "M4 6h11",
    "M19 6h1",
    "M4 12h6",
    "M14 12h6",
    "M4 18h9",
    "M17 18h3",
    "M15 6a2 2 0 1 0 3.9 0 2 2 0 0 0-3.9 0Z",
    "M10 12a2 2 0 1 0 3.9 0 2 2 0 0 0-3.9 0Z",
    "M13 18a2 2 0 1 0 3.9 0 2 2 0 0 0-3.9 0Z",
  ],
  sales: [
    "M3 7.5 9 13l4-4 8 8",
    "M21 17v-4h-4",
  ],
  trends: ["M3 12h4l3 8 4-16 3 8h4"],
  buyers: [
    "M9 8a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 8Z",
    "M3.5 20a5.5 5.5 0 0 1 11 0",
    "M16 4.5a3 3 0 0 1 0 5.8",
    "M17 14.5a5.5 5.5 0 0 1 3.5 5.5",
  ],
  trademarks: ["M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6Z", "m9 12 2 2 4-4"],
  portfolio: ["M3 7h18v13H3z", "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", "M3 12h18"],
  experiments: ["M9 3h6", "M10 3v6l-5 8.5A2 2 0 0 0 6.7 21h10.6a2 2 0 0 0 1.7-3.5L14 9V3", "M7.5 15h9"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"],
  menu: ["M3 6h18", "M3 12h18", "M3 18h18"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  check: ["m4 12 5 5L20 6"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  shield: ["M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6Z"],
  spark: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "m5.6 5.6 2.8 2.8", "m15.6 15.6 2.8 2.8", "m18.4 5.6-2.8 2.8", "m8.4 15.6-2.8 2.8"],
};

export function Icon({
  name,
  size = 18,
  ...rest
}: { name: keyof typeof PATHS | string; size?: number } & SVGProps<SVGSVGElement>) {
  const paths = PATHS[name] ?? PATHS.console;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <rect
          x="1.5"
          y="1.5"
          width="29"
          height="29"
          rx="9"
          fill="var(--color-accent)"
        />
        <rect
          x="1.5"
          y="1.5"
          width="29"
          height="29"
          rx="9"
          fill="var(--color-accent-ink)"
          opacity="0.14"
        />
        <g stroke="var(--color-accent-ink)" strokeWidth="1.6" fill="none">
          <circle cx="16" cy="16" r="7.5" />
          <circle cx="16" cy="16" r="3" />
          <path d="M16 16 22 10" />
        </g>
      </svg>
    </span>
  );
}
