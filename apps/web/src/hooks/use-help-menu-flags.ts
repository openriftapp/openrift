import latestMilestone from "virtual:latest-milestone";

import { milestoneBannerDecision } from "@/features/marketing/lib/milestone-banner";
import { useHydrated } from "@/hooks/use-hydrated";
import { isStandaloneDisplay } from "@/lib/install-platform";
import { useMilestoneBannerStore } from "@/stores/milestone-banner-store";

export function useHelpMenuFlags(): { showInstall: boolean; hasNewMilestone: boolean } {
  const hydrated = useHydrated();
  const dismissedDate = useMilestoneBannerStore((state) => state.dismissedDate);
  return {
    showInstall: hydrated && !isStandaloneDisplay(),
    hasNewMilestone: hydrated && milestoneBannerDecision(latestMilestone, dismissedDate) === "show",
  };
}
