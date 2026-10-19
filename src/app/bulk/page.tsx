import type { Metadata } from "next";
import { BulkView } from "./bulk-view";

export const metadata: Metadata = {
  title: "Bulk scan — Domain Radar",
};

export default function BulkPage() {
  return <BulkView />;
}
