import { useEffect } from "react";
import latestMilestone from "virtual:latest-milestone";

import type { LatestMilestone } from "@/features/marketing/lib/milestone-banner";
import { milestoneBannerDecision } from "@/features/marketing/lib/milestone-banner";
import { useHydrated } from "@/hooks/use-hydrated";
import { useMilestoneBannerStore } from "@/stores/milestone-banner-store";

/** The milestone to announce, or null. Seeds the dismissed date on a first visit. */
export function useMilestoneBanner(): LatestMilestone | null {
  const hydrated = useHydrated();
  const dismissedDate = useMilestoneBannerStore((state) => state.dismissedDate);
  const dismiss = useMilestoneBannerStore((state) => state.dismiss);
  const decision = hydrated ? milestoneBannerDecision(latestMilestone, dismissedDate) : "hide";

  useEffect(() => {
    if (decision === "seed" && latestMilestone !== null) {
      dismiss(latestMilestone.date);
    }
  }, [decision, dismiss]);

  return decision === "show" ? latestMilestone : null;
}
