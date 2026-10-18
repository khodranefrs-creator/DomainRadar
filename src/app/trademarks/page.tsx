import type { Metadata } from "next";
import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export const metadata: Metadata = { title: "Trademarks" };

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Trademark review"
      description="Preliminary, manual trademark checks. Never a guarantee and never auto-green."
      milestone="Milestone 6"
      planned={[
        "Manual TMview and WIPO Global Brand Database checks",
        "Missing review stays UNKNOWN, not GREEN",
        "CRITICAL/HIGH risk gates the BUY decision",
      ]}
      dataNeeds={[
        "Manual TMview / WIPO Global Brand Database research",
        "Risk-level and gate fields attached to each candidate",
        "An explicit UNKNOWN default whenever a review is absent",
      ]}
    />
  );
}
