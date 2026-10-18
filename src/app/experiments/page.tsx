import type { Metadata } from "next";
import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export const metadata: Metadata = { title: "Experiments" };

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Research lab"
      description="Reproducible experiments and backtesting without future-data leakage."
      milestone="Milestone 9"
      planned={[
        "Saved filter presets and generation rules",
        "Track recommended vs rejected vs sold",
        "Calibration only when outcomes exist",
      ]}
      dataNeeds={[
        "Saved filter and generation-rule presets",
        "Outcome tracking from shortlist through to sale",
        "A large enough realized-outcome set before any calibration is shown",
      ]}
    />
  );
}
