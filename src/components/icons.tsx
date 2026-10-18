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
  sales: ["M3 7.5 9 13l4-4 8 8", "M21 17v-4h-4"],
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
  arrowUpRight: ["M7 17 17 7", "M9 7h8v8"],
  check: ["m4 12 5 5L20 6"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  shield: ["M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6Z"],
  spark: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "m5.6 5.6 2.8 2.8", "m15.6 15.6 2.8 2.8", "m18.4 5.6-2.8 2.8", "m8.4 15.6-2.8 2.8"],
  chevron: ["m9 6 6 6-6 6"],
  chevronDown: ["m6 9 6 6 6-6"],
  expand: ["m7 10 5 5 5-5"],
  filter: ["M4 6h16", "M7 12h10", "M10 18h4"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  refresh: ["M20 11a8 8 0 1 0-2.3 5.7", "M20 5v6h-6"],
  layers: ["m12 3 8 4.5-8 4.5-8-4.5L12 3Z", "m4 12 8 4.5 8-4.5", "m4 16.5 8 4.5 8-4.5"],
  globe: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M3 12h18", "M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z"],
  alert: ["M12 4 2.5 20h19L12 4Z", "M12 10v4", "M12 17.2h.01"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 11v5", "M12 7.8h.01"],
  copy: ["M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16", "M4 9.5A1.5 1.5 0 0 1 5.5 8h9A1.5 1.5 0 0 1 16 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 18.5v-9Z"],
  download: ["M12 4v11", "m7 11 5 5 5-5", "M5 20h14"],
  upload: ["M12 20V6", "m7 12 5-5 5 5", "M4 4h16"],
  dots: ["M6 12h.01", "M12 12h.01", "M18 12h.01"],
  sort: ["M7 4v16", "m4 8 3-4 3 4", "M17 20V4", "m14 16 3 4 3-4"],
  scale: ["M12 4v16", "M5 8h14", "M7 8l-3 6h6L7 8Z", "M17 8l-3 6h6l-3-6Z"],
  key: ["M15 7a4 4 0 1 0-3.6 4L9 13.5l-1.5-1.5L6 13.5 4 11.5 5.6 10h.9l1.1-1.1", "M15 7h.01"],
  tag: ["M20.5 12.5 12 21l-9-9V3h9l8.5 8.5a1 1 0 0 1 0 1Z", "M7.5 7.5h.01"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3.5 6h.01", "M3.5 12h.01", "M3.5 18h.01"],
  compass: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "m15.5 8.5-2.3 5.7-5.7 2.3 2.3-5.7 5.7-2.3Z"],
  scale2: ["M12 3v18", "M6 7h12", "M2 12h8", "M14 12h8"],
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  ...rest
}: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
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

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0"
    >
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="9"
        fill="var(--color-panel-2)"
        stroke="var(--color-line-3)"
      />
      <g stroke="var(--color-accent)" strokeWidth="1.5" fill="none" opacity="0.55">
        <path d="M16 24a8 8 0 0 0 0-16" />
        <path d="M16 20a4 4 0 0 0 0-8" />
      </g>
      <path d="M16 22v-8" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="12" r="2.1" fill="var(--color-accent)" />
    </svg>
  );
}
