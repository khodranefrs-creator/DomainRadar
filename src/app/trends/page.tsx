import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Trends & News"
      description="Sector and technology signals from permitted feeds and manual trend imports."
      milestone="Milestone 5"
      planned={["RSS/Atom ingestion with dedupe and provenance","Manual Google Trends CSV import","Short investor-relevance note per signal"]}
    />
  );
}
