import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MobileNav, Sidebar } from "@/components/sidebar";

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
    "Evidence-first domain intelligence. RDAP-backed availability across every verified extension — nothing invented.",
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
        <MobileNav />
        <div className="flex md:min-h-screen">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
            <footer className="border-t border-[var(--color-border)] px-6 py-4 text-xs text-[var(--color-faint)]">
              Domain Radar · evidence-first · unverified lookups are never shown
              as available · no data is invented
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
