import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";
import { AppChrome } from "@/components/app-shell";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Domain Radar — evidence-first domain intelligence",
    template: "%s · Domain Radar",
  },
  description:
    "Investigate a name across every verified registry extension. RDAP-backed registry state, provider evidence, and honest uncertainty — nothing invented.",
};

export const viewport: Viewport = {
  themeColor: "#0d0e13",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${interTight.variable} ${geistMono.variable}`}>
      <body>
        <a href="#content" className="skip">
          Skip to content
        </a>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
