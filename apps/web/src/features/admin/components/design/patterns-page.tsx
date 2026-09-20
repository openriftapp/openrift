import type { DesignSection } from "@/features/admin/components/design/design-sections";
import { DesignTierPage } from "@/features/admin/components/design/design-tier-page";

import { CARD_MEDIA_GROUPS, CardMediaSection } from "./patterns/card-media-section";
import { CARD_STRIPS_GROUPS, CardStripsSection } from "./patterns/card-strips-section";
import { META_ARCHIVE_GROUPS, MetaArchiveSection } from "./patterns/meta-archive-section";
import { SEARCH_GROUPS, SearchSection } from "./patterns/search-section";
import { SELECTION_GROUPS, SelectionSection } from "./patterns/selection-section";
import { SHARE_GROUPS, ShareSection } from "./patterns/share-section";
import { TOP_BAR_GROUPS, TopBarSection } from "./patterns/top-bar-section";

const SECTIONS: readonly DesignSection[] = [
  { id: "top-bar", title: "Page top bar", Component: TopBarSection, groups: TOP_BAR_GROUPS },
  { id: "search", title: "Search & filters", Component: SearchSection, groups: SEARCH_GROUPS },
  {
    id: "card-media",
    title: "Card media",
    Component: CardMediaSection,
    groups: CARD_MEDIA_GROUPS,
  },
  {
    id: "card-strips",
    title: "Card strips",
    Component: CardStripsSection,
    groups: CARD_STRIPS_GROUPS,
  },
  {
    id: "selection",
    title: "Selection mode",
    Component: SelectionSection,
    groups: SELECTION_GROUPS,
  },
  { id: "share", title: "Copy & share", Component: ShareSection, groups: SHARE_GROUPS },
  {
    id: "meta-archive",
    title: "Meta archive",
    Component: MetaArchiveSection,
    groups: META_ARCHIVE_GROUPS,
  },
];

export function DesignPatternsPage() {
  return (
    <DesignTierPage
      description="Surfaces composed from the primitives, shown the way a real page assembles them."
      sections={SECTIONS}
    />
  );
}
