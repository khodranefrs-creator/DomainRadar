import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Sales & Comps"
      description="Individual sales database (manual/CSV) and NameBio free aggregate statistics."
      milestone="Milestone 3–4"
      planned={["Manual + CSV individual sales entry","Comparability ranking by keyword placement and TLD","NameBio RetailStats/TLDStats with attribution and 24h cache"]}
    />
  );
}
