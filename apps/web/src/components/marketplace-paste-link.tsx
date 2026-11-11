import { CARDMARKET_WANTS_URL, CARDTRADER_WISHLIST_URL } from "@openrift/shared/marketplace";
import { ExternalLinkIcon } from "lucide-react";

import { MarketplaceLink } from "@/components/marketplace-link";
import { buttonVariants } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

export function MarketplacePasteLink({
  marketplace,
}: {
  marketplace: "cardmarket" | "cardtrader";
}) {
  return (
    <MarketplaceLink
      marketplace={marketplace}
      href={marketplace === "cardmarket" ? CARDMARKET_WANTS_URL : CARDTRADER_WISHLIST_URL}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <ExternalLinkIcon />
      {marketplace === "cardmarket" ? m.shared_open_cardmarket() : m.shared_open_cardtrader()}
    </MarketplaceLink>
  );
}
