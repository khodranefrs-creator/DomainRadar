import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default function CandidatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
