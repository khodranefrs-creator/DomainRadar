import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Portfolio"
      description="Holdings, renewals, listings and realized outcomes."
      milestone="Milestone 8"
      planned={["Acquisition cost, renewal dates, registrar","Renewal deadline alerts","Realized profit and concentration"]}
    />
  );
}
