import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";

import { formatList } from "@/lib/format-list";

export const MARKETPLACE_COUNT = ALL_MARKETPLACES.length;

/** "TCGplayer, Cardmarket, CardTrader, and CardNexus" in the viewer's language; `or` for a choice. */
export function marketplaceNames(type: "and" | "or" = "and"): string {
  return formatList(
    ALL_MARKETPLACES.map((marketplace) => MARKETPLACE_LINKS[marketplace].label),
    type,
  );
}
