import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Buyer Intelligence"
      description="Possible end-user companies with a specific, evidence-backed acquisition rationale."
      milestone="Milestone 6"
      planned={["Company, website, sector and rationale fields","Verified company vs plausible prospect distinction","No automated unsolicited outreach"]}
    />
  );
}
