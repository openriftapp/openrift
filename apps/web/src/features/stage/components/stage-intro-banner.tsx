import { ParaglideMessage } from "@inlang/paraglide-js-react";
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
        <ParaglideMessage
          message={m.stage_intro_keys_description}
          markup={{
            kbd: ({ children }) => <Kbd>{children}</Kbd>,
            kbd2: ({ children }) => <Kbd>{children}</Kbd>,
          }}
        />
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
