import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Sales & comparables"
      description="Individual sales database (manual/CSV) and NameBio free aggregate statistics."
      milestone="Milestone 3–4"
      planned={[
        "Manual + CSV individual sales entry",
        "Comparability ranking by keyword placement and TLD",
        "NameBio RetailStats/TLDStats with attribution and 24h cache",
      ]}
      dataNeeds={[
        "A permitted individual-sales dataset or manual CSV entry",
        "A comparability model (keyword placement, extension, length)",
        "NameBio aggregate statistics with attribution and a 24h cache",
      ]}
    />
  );
}
