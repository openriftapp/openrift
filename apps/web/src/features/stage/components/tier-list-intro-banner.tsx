import { Link } from "@tanstack/react-router";
import { GripVerticalIcon, MonitorPlayIcon, PencilIcon, PointerIcon, SaveIcon } from "lucide-react";

import type { IntroGuideRow } from "@/components/intro-banner";
import { IntroBanner, IntroGuideList } from "@/components/intro-banner";
import { TextLink } from "@/components/ui/text-link";
import { m } from "@/paraglide/messages.js";

function guideRows(): readonly IntroGuideRow[] {
  return [
    {
      icons: [GripVerticalIcon],
      title: m.tier_lists_intro_drag_title(),
      description: m.tier_lists_intro_drag_description(),
      desktopOnly: true,
    },
    {
      icons: [PointerIcon],
      title: m.tier_lists_intro_tap_title(),
      description: m.tier_lists_intro_tap_description(),
      mobileOnly: true,
    },
    {
      icons: [PencilIcon],
      title: m.tier_lists_intro_rows_title(),
      description: m.tier_lists_intro_rows_description(),
    },
    {
      icons: [SaveIcon],
      title: m.tier_lists_intro_save_title(),
      description: m.tier_lists_intro_save_description(),
    },
    {
      icons: [MonitorPlayIcon],
      title: m.tier_lists_intro_stream_title(),
      description: m.tier_lists_intro_stream_description(),
    },
  ];
}

export function TierListIntroBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <IntroBanner
      title={m.tier_lists_intro_title()}
      lead={m.tier_lists_intro_lead()}
      onDismiss={onDismiss}
    >
      <IntroGuideList rows={guideRows()} />
      <TextLink render={<Link to="/help/$slug" params={{ slug: "tier-lists" }} />}>
        {m.stage_intro_read_guide()}
      </TextLink>
    </IntroBanner>
  );
}
