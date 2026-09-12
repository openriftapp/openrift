import { createContext } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DeckOverviewTab } from "@/features/decks/stores/deck-builder-ui-store";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { m } from "@/paraglide/messages.js";

// `null` means the host's slot hasn't attached yet (render nothing);
// `undefined` means there is no host, so a standalone consumer stays inline.
export const PlanTabActionsContext = createContext<HTMLElement | null | undefined>(undefined);

export const SECTION_SCROLL_MARGIN = "calc(var(--sticky-top, 57px) + 3.5rem)";

export function TabStrip({
  tab,
  onTabChange,
  showPlanTab,
  showBoxTab,
  trailing,
  trailingMobile,
}: {
  tab: DeckOverviewTab;
  onTabChange: (tab: DeckOverviewTab) => void;
  showPlanTab: boolean;
  showBoxTab: boolean;
  trailing?: React.ReactNode;
  trailingMobile?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  // Exactly one of trailing/trailingMobile renders: the Plan tab's trailing is
  // a portal target and must never duplicate.
  const inlineTrailing = isMobile ? (trailingMobile ?? trailing) : trailing;
  return (
    <div className="flex h-10 items-end gap-6 border-b">
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as DeckOverviewTab)}
        className="-mb-px"
      >
        <TabsList variant="line" aria-label={m.decks_overview_tabs_label()}>
          <TabsTrigger value="overview">{m.decks_overview_tab_deck()}</TabsTrigger>
          <TabsTrigger value="test">{m.decks_overview_tab_test()}</TabsTrigger>
          {showPlanTab && <TabsTrigger value="plan">{m.decks_overview_tab_plan()}</TabsTrigger>}
          {showBoxTab && <TabsTrigger value="box">{m.decks_overview_tab_box()}</TabsTrigger>}
        </TabsList>
      </Tabs>
      {inlineTrailing && (
        <div className="ml-auto flex items-center gap-2 pb-1.5">{inlineTrailing}</div>
      )}
    </div>
  );
}
