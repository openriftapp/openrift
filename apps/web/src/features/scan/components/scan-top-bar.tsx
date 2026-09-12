import { SlidersHorizontalIcon } from "lucide-react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import type { ScanSettingsProps } from "@/features/scan/components/scan-settings-menu";
import { ScanSettingsMenu } from "@/features/scan/components/scan-settings-menu";
import { m } from "@/paraglide/messages.js";

export function ScanTopBar({ settings }: { settings: ScanSettingsProps }) {
  return (
    <PageTopBarSticky width="capped">
      <PageTopBar>
        <PageTopBarTitle>{m.scan_top_bar_title()}</PageTopBarTitle>
        <PageTopBarActions>
          <ScanSettingsMenu
            {...settings}
            trigger={<PageTopBarButton />}
            triggerContent={
              <>
                <SlidersHorizontalIcon className="size-4" />
                {m.scan_top_bar_settings()}
              </>
            }
          />
        </PageTopBarActions>
      </PageTopBar>
    </PageTopBarSticky>
  );
}
