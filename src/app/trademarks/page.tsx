import { MilestonePlaceholder } from "@/components/milestone-placeholder";

export default function Page() {
  return (
    <MilestonePlaceholder
      title="Trademark Review"
      description="Preliminary, manual trademark checks. Never a guarantee and never auto-green."
      milestone="Milestone 6"
      planned={["Manual TMview and WIPO Global Brand Database checks","Missing review stays UNKNOWN, not GREEN","CRITICAL/HIGH risk gates the BUY decision"]}
    />
  );
}
