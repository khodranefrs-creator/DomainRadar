import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ScannerView } from "./scanner-view";

export const metadata: Metadata = {
  title: "Investigate",
};

export default function ScannerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Investigate"
        title="A name, against every registry"
        lead="Choose the extensions to query and run a live RDAP check. RDAP reports registry state only — “no record” means nothing was returned, not that the domain is available to register."
      />
      <Suspense fallback={<ScannerSkeleton />}>
        <ScannerView />
      </Suspense>
    </div>
  );
}

function ScannerSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
      <div className="skeleton h-[420px]" />
      <div className="skeleton h-[420px]" />
    </div>
  );
}
