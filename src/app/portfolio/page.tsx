import type { Metadata } from "next";
import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export const metadata: Metadata = { title: "Portfolio" };

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Portfolio"
      description="Holdings, renewals, listings and realized outcomes."
      milestone="Milestone 8"
      planned={[
        "Acquisition cost, renewal dates, registrar",
        "Renewal deadline alerts",
        "Realized profit and concentration",
      ]}
      dataNeeds={[
        "Holding records: registrar, cost, renewal date",
        "Renewal-alert scheduling",
        "Realized-outcome capture when a domain sells",
      ]}
    />
  );
}
