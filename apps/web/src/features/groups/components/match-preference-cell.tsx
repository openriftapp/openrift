import type { MarketplaceInfo } from "@openrift/shared/types/api/pricing";
import type {
  EffectiveTradePreference,
  TradePricePref,
} from "@openrift/shared/types/api/trade-preferences";
import type { Marketplace } from "@openrift/shared/types/pricing";

import { TextLink } from "@/components/ui/text-link";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { MARKETPLACE_META } from "@/features/cards/lib/marketplace-meta";
import { formatterForMarketplace } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

import {
  formatAbsolutePrice,
  pricePrefShortLabel,
  tradeTypeLabel,
} from "./trade-preference-labels";

const PREF_TO_MARKETPLACE: Record<TradePricePref, Marketplace | null> = {
  cm_lowest: "cardmarket",
  tcg_lowest: "tcgplayer",
  ct_zero: "cardtrader",
  absolute: null,
};

interface MatchPreferenceCellProps {
  label: string;
  pref: EffectiveTradePreference;
  marketplaceInfos: Record<Marketplace, MarketplaceInfo> | null;
  searchQuery: string;
}

export function MatchPreferenceCell({
  label,
  pref,
  marketplaceInfos,
  searchQuery,
}: MatchPreferenceCellProps) {
  const priceNode = renderPrice(pref, marketplaceInfos, searchQuery);
  const typeNode = pref.tradeType ? tradeTypeLabel(pref.tradeType) : null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-2 py-1">
      <span className="text-muted-foreground text-2xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-xs whitespace-nowrap">
        {priceNode ?? m.trades_not_set()}
        {typeNode ? <span className="text-muted-foreground"> · {typeNode}</span> : null}
      </span>
    </div>
  );
}

function marketplacePriceText(
  pref: TradePricePref,
  cardtraderPrice: number | undefined,
): string | undefined {
  if (pref === "absolute") {
    return undefined;
  }
  const marketplace = pricePrefShortLabel(pref);
  if (pref === "ct_zero" && cardtraderPrice !== undefined) {
    return m.trades_pref_price_at({
      price: formatterForMarketplace("cardtrader")(cardtraderPrice),
      marketplace,
    });
  }
  return m.trades_pref_marketplace_price({ marketplace });
}

export function MatchPreferenceText({
  pref,
  printingId,
  marketplaceInfos,
  searchQuery,
}: Omit<MatchPreferenceCellProps, "label"> & { printingId: string }) {
  const prices = usePrices();
  const linkText =
    pref.pricePref === null
      ? undefined
      : marketplacePriceText(pref.pricePref, prices.get(printingId, "cardtrader"));
  const priceNode = renderPrice(pref, marketplaceInfos, searchQuery, linkText);
  const typeNode = pref.tradeType ? tradeTypeLabel(pref.tradeType) : null;
  if (priceNode === null && typeNode === null) {
    return null;
  }
  return (
    <span className="text-sm">
      {priceNode ?? m.trades_not_set()}
      {typeNode ? <span className="text-muted-foreground"> · {typeNode}</span> : null}
    </span>
  );
}

function renderPrice(
  pref: EffectiveTradePreference,
  marketplaceInfos: Record<Marketplace, MarketplaceInfo> | null,
  searchQuery: string,
  linkText?: string,
) {
  if (pref.pricePref === null) {
    return null;
  }
  if (pref.pricePref === "absolute") {
    return formatAbsolutePrice(pref.priceAbsoluteCents, pref.currency);
  }
  const marketplace = PREF_TO_MARKETPLACE[pref.pricePref];
  if (marketplace === null) {
    return pricePrefShortLabel(pref.pricePref);
  }
  const meta = MARKETPLACE_META[marketplace];
  const productId = marketplaceInfos?.[marketplace]?.productId ?? null;
  const href = productId === null ? meta.searchUrl(searchQuery) : meta.productUrl(productId);
  return (
    <TextLink
      variant="muted"
      className="relative"
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      {linkText ?? pricePrefShortLabel(pref.pricePref)}
    </TextLink>
  );
}
