import type { Metadata } from "next";
import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export const metadata: Metadata = { title: "Buyers" };

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Buyer intelligence"
      description="Possible end-user companies with a specific, evidence-backed acquisition rationale."
      milestone="Milestone 6"
      planned={[
        "Company, website, sector and rationale fields",
        "Verified company vs plausible prospect distinction",
        "No automated unsolicited outreach",
      ]}
      dataNeeds={[
        "Company, website, sector and rationale fields",
        "A verified-company vs plausible-prospect distinction",
        "Human-only outreach decisions — nothing automated",
      ]}
    />
  );
}
