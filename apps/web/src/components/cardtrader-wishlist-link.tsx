import { CARDTRADER_WISHLIST_URL } from "@openrift/shared/marketplace";
import { ExternalLinkIcon } from "lucide-react";

import { MarketplaceLink } from "@/components/marketplace-link";
import { buttonVariants } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

export function CardtraderWishlistLink() {
  return (
    <MarketplaceLink
      marketplace="cardtrader"
      href={CARDTRADER_WISHLIST_URL}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <ExternalLinkIcon />
      {m.shared_open_cardtrader()}
    </MarketplaceLink>
  );
}
