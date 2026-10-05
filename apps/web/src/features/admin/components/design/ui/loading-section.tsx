import { SaveIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { PageTopBarButton } from "@/components/layout/page-top-bar";
import { ShowMoreButton } from "@/components/show-more-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";

const GROUPS = {
  spinner: { id: "loading-spinner", title: "Spinner & pending" },
  showMore: { id: "loading-show-more", title: "ShowMoreButton" },
} as const;

export const LOADING_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function LoadingSection() {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <DemoSection
      id="loading"
      title="Loading & paging"
      note="The one spinner glyph, a button waiting on its action, and the show-more control under or beside a list."
      docs="components/ui/spinner.tsx · components/ui/button.tsx (pending) · components/show-more-button.tsx"
    >
      <DemoGroup
        {...GROUPS.spinner}
        hint="Never hand-roll an animate-spin icon. A pending button swaps its leading icon for the spinner and disables itself."
      >
        <DemoGrid>
          <Demo name="Spinner" hint="Standalone, for a region still loading.">
            <Spinner />
            <Spinner className="size-6" />
          </Demo>
          <Demo name="Button pending" hint="The leading icon gives way to the spinner.">
            <Button pending>
              <SaveIcon />
              Save deck
            </Button>
            <Button variant="outline" size="sm" pending>
              Import
            </Button>
            <Button variant="ghost" size="icon" pending aria-label="Delete">
              <Trash2Icon />
            </Button>
          </Demo>
          <Demo name="PageTopBarButton pending" hint="Top-bar wrappers forward pending.">
            <PageTopBarButton pending>
              <SaveIcon />
              Publish
            </PageTopBarButton>
          </Demo>
        </DemoGrid>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.showMore}
        hint='Without children it says "Show all {count}" and "Show fewer". Pass children for a paged "Show 20 more".'
      >
        <DemoRow label="heading" hint="A link beside the section heading toggles the full list.">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Heading>Finishes</Heading>
            <ShowMoreButton
              placement="heading"
              count={42}
              expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            />
          </div>
        </DemoRow>
        <DemoRow label="below" hint="A centered ghost button under the list fetches the next page.">
          <div className="w-full max-w-md">
            <ShowMoreButton pending={pending} onClick={() => setPending(true)}>
              Show 20 more
            </ShowMoreButton>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPending(false)}>
            Reset
          </Button>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
