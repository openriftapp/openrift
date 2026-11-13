import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import type { Marketplace } from "@openrift/shared/types/pricing";

import { MARKETPLACE_ICONS } from "@/lib/marketplace-icons";

interface MarketplaceMeta {
  label: string;
  icon: string;
  searchUrl: (query: string) => string;
  productUrl: (productId: number, language?: string | null) => string;
  isAffiliate: boolean;
}

export const MARKETPLACE_META: Record<Marketplace, MarketplaceMeta> = Object.fromEntries(
  Object.entries(MARKETPLACE_LINKS).map(([marketplace, links]) => [
    marketplace,
    { ...links, icon: MARKETPLACE_ICONS[marketplace as Marketplace] },
  ]),
) as Record<Marketplace, MarketplaceMeta>;
