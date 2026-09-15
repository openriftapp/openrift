import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useEffect } from "react";
import latestMilestone from "virtual:latest-milestone";

import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { milestoneBannerDecision } from "@/features/marketing/lib/milestone-banner";
import { MilestoneIcon } from "@/features/marketing/lib/milestone-icons";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn, CONTAINER_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useMilestoneBannerStore } from "@/stores/milestone-banner-store";

export function MilestoneBanner() {
  const hydrated = useHydrated();
  const dismissedDate = useMilestoneBannerStore((state) => state.dismissedDate);
  const dismiss = useMilestoneBannerStore((state) => state.dismiss);
  const decision = hydrated ? milestoneBannerDecision(latestMilestone, dismissedDate) : "hide";

  useEffect(() => {
    if (decision === "seed" && latestMilestone !== null) {
      dismiss(latestMilestone.date);
    }
  }, [decision, dismiss]);

  if (decision !== "show" || latestMilestone === null) {
    return null;
  }
  const milestone = latestMilestone;

  return (
    <div className="bg-primary/10 border-primary/20 relative z-40 border-b">
      <div className={cn(CONTAINER_WIDTH, "px-safe flex items-center gap-3 py-2 text-sm")}>
        <MilestoneIcon token={milestone.icon} className="text-primary size-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{milestone.title}</span>
          <span className="text-muted-foreground"> {milestone.message} </span>
          <TextLink render={<Link to="/changelog" />}>
            {m.marketing_milestone_banner_link()}
          </TextLink>
        </p>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={m.marketing_milestone_banner_dismiss()}
          onClick={() => dismiss(milestone.date)}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
