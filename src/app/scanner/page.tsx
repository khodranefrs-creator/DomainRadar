import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ScannerView } from "./scanner-view";

export const metadata = {
  title: "Investigate · Domain Radar",
};

export default function ScannerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Investigate"
        title="Registry lookup"
        lead="Live RDAP lookups across the extensions you select. RDAP reports registry state only — “Not found” means no registry record was returned, it is not proof a domain is available to register."
      />
      <Suspense fallback={<ScannerSkeleton />}>
        <ScannerView />
      </Suspense>
    </div>
  );
}

function ScannerSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
      <div className="skeleton h-[420px]" />
      <div className="skeleton h-[420px]" />
    </div>
  );
}
