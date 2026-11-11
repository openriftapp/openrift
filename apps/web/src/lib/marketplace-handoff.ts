import {
  CARDMARKET_WANTS_URL,
  CARDTRADER_WISHLIST_URL,
  cardnexusCartWizardUrl,
  tcgplayerMassEntryUrl,
} from "@openrift/shared/marketplace";
import type { Marketplace } from "@openrift/shared/types/pricing";

import { formatCardmarketWants, formatCardtraderWishlist } from "@/lib/export-text";
import { m } from "@/paraglide/messages.js";

export interface HandoffItem {
  printingId?: string;
  quantity: number;
  name: string;
  language?: string | null;
  finish?: string | null;
}

export type MarketplaceHandoff =
  | {
      kind: "cart";
      marketplace: "tcgplayer" | "cardnexus";
      href: string;
      sent: number;
      unlisted: number;
    }
  | { kind: "paste"; marketplace: "cardmarket" | "cardtrader"; href: string; text: string };

/**
 * TCGplayer and CardNexus take the exact printings through a cart URL; Cardmarket and CardTrader
 * only accept a pasted name list.
 */
export function marketplaceHandoff(
  marketplace: Marketplace,
  items: readonly HandoffItem[],
  productIdOf: (printingId: string) => number | null | undefined,
): MarketplaceHandoff {
  if (marketplace === "cardmarket" || marketplace === "cardtrader") {
    const lines = items.map((item) => ({ name: item.name, quantity: item.quantity }));
    return marketplace === "cardmarket"
      ? {
          kind: "paste",
          marketplace,
          href: CARDMARKET_WANTS_URL,
          text: formatCardmarketWants(lines),
        }
      : {
          kind: "paste",
          marketplace,
          href: CARDTRADER_WISHLIST_URL,
          text: formatCardtraderWishlist(lines),
        };
  }

  const listed = items.flatMap((item) => {
    const productId = item.printingId === undefined ? undefined : productIdOf(item.printingId);
    return productId === null || productId === undefined ? [] : [{ ...item, productId }];
  });
  const sent = listed.reduce((sum, item) => sum + item.quantity, 0);
  const unlisted = items.length - listed.length;
  const href =
    marketplace === "tcgplayer" ? tcgplayerMassEntryUrl(listed) : cardnexusCartWizardUrl(listed);
  return { kind: "cart", marketplace, href, sent, unlisted };
}

export function marketplaceCartLabel(
  marketplace: "tcgplayer" | "cardnexus",
  count: number,
): string {
  return marketplace === "tcgplayer"
    ? m.shared_marketplace_cart_tcgplayer({ count })
    : m.shared_marketplace_cart_cardnexus({ count });
}

export function marketplaceUnlistedNote(
  marketplace: "tcgplayer" | "cardnexus",
  count: number,
): string {
  return marketplace === "tcgplayer"
    ? m.shared_marketplace_unlisted_tcgplayer({ count })
    : m.shared_marketplace_unlisted_cardnexus({ count });
}
