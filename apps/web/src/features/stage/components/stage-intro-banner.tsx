import { Link } from "@tanstack/react-router";
import { KeyboardIcon, ListPlusIcon, MonitorIcon, RadioTowerIcon } from "lucide-react";

import type { IntroGuideRow } from "@/components/intro-banner";
import { IntroBanner, IntroGuideList } from "@/components/intro-banner";
import { Kbd } from "@/components/ui/kbd";
import { TextLink } from "@/components/ui/text-link";
import { m } from "@/paraglide/messages.js";

function guideRows(): readonly IntroGuideRow[] {
  return [
    {
      icons: [ListPlusIcon],
      title: m.stage_intro_queue_title(),
      description: m.stage_intro_queue_description(),
    },
    {
      icons: [MonitorIcon],
      title: m.stage_intro_screen_title(),
      description: m.stage_intro_screen_description(),
    },
    {
      icons: [RadioTowerIcon],
      title: m.stage_intro_obs_title(),
      description: m.stage_intro_obs_description(),
    },
    {
      icons: [KeyboardIcon],
      title: m.stage_intro_keys_title(),
      description: (
        <>
          {m.stage_intro_keys_description_before()} <Kbd>P</Kbd>{" "}
          {m.stage_intro_keys_description_middle()} <Kbd>?</Kbd>{" "}
          {m.stage_intro_keys_description_end()}
        </>
      ),
      desktopOnly: true,
    },
  ];
}

export function StageIntroBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <IntroBanner title={m.stage_intro_title()} lead={m.stage_intro_lead()} onDismiss={onDismiss}>
      <IntroGuideList rows={guideRows()} />
      <TextLink render={<Link to="/help/$slug" params={{ slug: "stage" }} />}>
        {m.stage_intro_read_guide()}
      </TextLink>
    </IntroBanner>
  );
}
