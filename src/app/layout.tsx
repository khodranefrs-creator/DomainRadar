import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Domain Radar",
  description:
    "Evidence-first domain investment research. Local-first, traceable, disciplined.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 px-6 py-6 max-w-[1600px] w-full mx-auto">
              {children}
            </div>
            <footer className="px-6 py-4 text-xs text-[var(--color-muted)] border-t border-[var(--color-border)]">
              Domain Radar · local-first · unverified lookups are never shown as
              available · no data is invented
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
