import { Link } from "@tanstack/react-router";
import { CopyIcon, EllipsisVerticalIcon, PlusIcon } from "lucide-react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarActions,
  PageTopBarBack,
  PageTopBarButton,
  PageTopBarIconButton,
  PageTopBarPrimaryButton,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { TopBarBreadcrumbTrail } from "@/components/layout/top-bar-breadcrumb";
import { Badge } from "@/components/ui/badge";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";

const GROUPS = {
  bar: { id: "top-bar-bar", title: "PageTopBar" },
  breadcrumb: { id: "top-bar-breadcrumb", title: "TopBarBreadcrumbTrail" },
} as const;

export const TOP_BAR_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function TopBarSection() {
  return (
    <DemoSection
      id="top-bar"
      title="Page top bar"
      note="The one title row a page gets, and the trail that leads it on a drill-down page."
    >
      <DemoGroup
        {...GROUPS.bar}
        hint="The intro paragraph goes below the bar as PageDescription, never inside it."
      >
        <DemoRow label="Back, title, badge, actions" className="flex-col items-stretch">
          <div className="bg-background w-full space-y-2">
            <PageTopBar>
              <PageTopBarBack to="/admin" aria-label="Back to admin" />
              <PageTopBarTitle>Summoner Skirmish</PageTopBarTitle>
              <Badge variant="muted" className="ml-2">
                Running
              </Badge>
              <PageTopBarActions>
                <PageTopBarButton>
                  <CopyIcon /> Copy code
                </PageTopBarButton>
                <PageTopBarPrimaryButton>
                  <PlusIcon /> Add entry
                </PageTopBarPrimaryButton>
                <PageTopBarIconButton aria-label="More actions">
                  <EllipsisVerticalIcon />
                </PageTopBarIconButton>
              </PageTopBarActions>
            </PageTopBar>
            <PageDescription>
              Sixteen summoners, four rounds of Swiss, then a top cut of four.
            </PageDescription>
          </div>
        </DemoRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.breadcrumb}
        hint="Leads a drill-down page below a tabbed area, and collapses to a back arrow on phones."
      >
        <DemoRow label="Trail" className="flex-col items-stretch">
          <PageTopBar className="w-full">
            <TopBarBreadcrumbTrail
              segments={[{ label: "Admin", link: <Link to="/admin" /> }, { label: "Design" }]}
            />
          </PageTopBar>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
