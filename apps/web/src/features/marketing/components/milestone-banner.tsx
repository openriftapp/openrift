import { Link } from "@tanstack/react-router";

import { SiteBannerStrip } from "@/components/layout/site-banner-strip";
import { TextLink } from "@/components/ui/text-link";
import type { LatestMilestone } from "@/features/marketing/lib/milestone-banner";
import { MilestoneIcon } from "@/features/marketing/lib/milestone-icons";
import { m } from "@/paraglide/messages.js";
import { useMilestoneBannerStore } from "@/stores/milestone-banner-store";

export function MilestoneBanner({ milestone }: { milestone: LatestMilestone }) {
  const dismiss = useMilestoneBannerStore((state) => state.dismiss);

  return (
    <SiteBannerStrip
      icon={<MilestoneIcon token={milestone.icon} />}
      dismissLabel={m.marketing_milestone_banner_dismiss()}
      onDismiss={() => dismiss(milestone.date)}
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{milestone.title}</span>
        <span className="text-muted-foreground"> {milestone.message} </span>
        <TextLink render={<Link to="/changelog" />}>{m.marketing_milestone_banner_link()}</TextLink>
      </p>
    </SiteBannerStrip>
  );
}
