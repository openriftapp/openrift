import { CARDMARKET_WANTS_URL } from "@openrift/shared/marketplace";
import { ExternalLinkIcon } from "lucide-react";

import { MarketplaceLink } from "@/components/marketplace-link";
import { buttonVariants } from "@/components/ui/button";

export function CardmarketWantsLink() {
  return (
    <MarketplaceLink
      marketplace="cardmarket"
      href={CARDMARKET_WANTS_URL}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <ExternalLinkIcon />
      Open Cardmarket
    </MarketplaceLink>
  );
}
