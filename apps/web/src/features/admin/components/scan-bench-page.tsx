import { PageDescription } from "@/components/layout/page-top-bar";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { ScanDeviceBenchCard } from "@/features/admin/components/scan-device-bench-card";
import { useScanServing } from "@/features/scan/hooks/use-scan-serving";
import { cn, PAGE_WIDTH } from "@/lib/utils";

export function ScanBenchPage() {
  const serving = useScanServing();

  return (
    <>
      <AdminPageTopBar title="Scan Bench" />
      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-4 pb-12")}>
        <PageDescription>
          Replays the recorded clips through this device&apos;s scanner. Keep the screen on and the
          tab in front until it finishes.
        </PageDescription>
        {serving.status === "unavailable" && (
          <p className="text-destructive">
            The scan bank is not available: it is not published yet, or the manifest did not load.
          </p>
        )}
        <ScanDeviceBenchCard assets={serving.assets} />
      </div>
    </>
  );
}
