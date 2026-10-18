import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Research Lab"
      description="Reproducible experiments and backtesting without future-data leakage."
      milestone="Milestone 9"
      planned={["Saved filter presets and generation rules","Track recommended vs rejected vs sold","Calibration only when outcomes exist"]}
    />
  );
}
