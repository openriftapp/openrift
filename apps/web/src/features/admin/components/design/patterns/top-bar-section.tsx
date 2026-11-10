import { Link } from "@tanstack/react-router";
import { CopyIcon, EllipsisVerticalIcon, PlusIcon } from "lucide-react";

import { PageHero, PageHeroStats } from "@/components/layout/page-hero";
import type { PageHeroStat } from "@/components/layout/page-hero";
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
  hero: { id: "top-bar-hero", title: "PageHero" },
} as const;

export const TOP_BAR_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const HERO_STATS: readonly PageHeroStat[] = [
  { key: "events", label: "archived events", value: "12" },
  { key: "decks", label: "decklists", value: "48" },
];

export function TopBarSection() {
  return (
    <DemoSection
      id="top-bar"
      title="Page top bar"
      note="The one title row a page gets, the trail that leads it on a drill-down page, and the hero a page opens with in its place."
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
              <Badge variant="neutral" className="ml-2">
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
      <DemoGroup
        {...GROUPS.hero}
        hint="The introduction a page opens with instead of the bar. compactOnPhone keeps only the title, the phone facts line and the children below md; narrow the window to see it."
      >
        <DemoRow label="Default" className="flex-col items-stretch">
          <div className="bg-background w-full">
            <PageHero
              eyebrow="Tournament results"
              title="Meta Archive"
              lead="Every Summoner Skirmish on file, with standings and decklists."
              width="full"
            >
              <PageHeroStats stats={HERO_STATS} />
            </PageHero>
          </div>
        </DemoRow>
        <DemoRow label="compactOnPhone" className="flex-col items-stretch">
          <div className="bg-background w-full">
            <PageHero
              eyebrow="Tournament results"
              title="Meta Archive"
              lead="Every Summoner Skirmish on file, with standings and decklists."
              width="full"
              compactOnPhone
              phoneFacts={["Results through Oct 9, 2026", "12 archived events", "48 decklists"]}
            >
              <PageHeroStats stats={HERO_STATS} className="max-md:hidden" />
            </PageHero>
          </div>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
