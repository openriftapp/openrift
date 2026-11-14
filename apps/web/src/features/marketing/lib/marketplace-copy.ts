import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";

import { getLocale } from "@/paraglide/runtime.js";

export const MARKETPLACE_COUNT = ALL_MARKETPLACES.length;

/** "TCGplayer, Cardmarket, CardTrader, and CardNexus" in the viewer's language; `or` for a choice. */
export function marketplaceNames(type: "and" | "or" = "and"): string {
  return new Intl.ListFormat(getLocale(), {
    type: type === "and" ? "conjunction" : "disjunction",
  }).format(ALL_MARKETPLACES.map((marketplace) => MARKETPLACE_LINKS[marketplace].label));
}
