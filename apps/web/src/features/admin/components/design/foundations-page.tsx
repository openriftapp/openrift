import type { DesignSection } from "@/features/admin/components/design/design-sections";
import { DesignTierPage } from "@/features/admin/components/design/design-tier-page";

import { DESIGN_ORNAMENTS_GROUPS, OrnamentsSection } from "./foundations/ornaments-section";
import { DESIGN_TOKENS_GROUPS, TokensSection } from "./foundations/tokens-section";
import { DESIGN_TYPE_GROUPS, TypeSection } from "./foundations/type-section";

const SECTIONS: readonly DesignSection[] = [
  { id: "tokens", title: "Tokens", Component: TokensSection, groups: DESIGN_TOKENS_GROUPS },
  { id: "type", title: "Type & text", Component: TypeSection, groups: DESIGN_TYPE_GROUPS },
  {
    id: "ornaments",
    title: "Ornaments",
    Component: OrnamentsSection,
    groups: DESIGN_ORNAMENTS_GROUPS,
  },
];

export function DesignFoundationsPage() {
  return (
    <DesignTierPage
      description="The theme vocabulary everything else is built from. Check both themes with the header toggle."
      sections={SECTIONS}
    />
  );
}
