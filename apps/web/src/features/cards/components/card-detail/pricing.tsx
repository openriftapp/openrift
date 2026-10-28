import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { snapshotHeadline } from "@openrift/shared/types/api/pricing";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Marketplace, TimeRange } from "@openrift/shared/types/pricing";
import { ArrowUpRightIcon } from "lucide-react";

import { MarketplaceIcon } from "@/components/marketplace-icon";
import { MarketplaceLink } from "@/components/marketplace-link";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { SectionHeading } from "@/components/ui/section-heading";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePriceHistory } from "@/features/cards/hooks/use-price-history";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { formatPrice, formatterForMarketplace, priceColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

interface PriceEntry {
  marketplace: Marketplace;
  value: number | null;
  url: string | null;
}

function usePriceEntries(printing: Printing, range: TimeRange): PriceEntry[] {
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const { data: history } = usePriceHistory(printing.printingId, range);
  const prices = usePrices();

  function latestPrice(marketplace: Marketplace): number | null {
    const snapshots = history?.[marketplace]?.snapshots;
    if (!snapshots?.length) {
      return null;
    }
    // oxlint-disable-next-line no-non-null-assertion -- length check above
    return snapshotHeadline(snapshots.at(-1)!);
  }

  // Catalog price is preferred over history since it doesn't wait on history to load.
  const chips: PriceEntry[] = [];
  for (const marketplace of marketplaceOrder) {
    const links = MARKETPLACE_LINKS[marketplace];
    const slice = history?.[marketplace];
    const productId = slice?.productId ?? null;
    const url = productId ? links.productUrl(productId, printing.language) : null;

    const value = prices.get(printing.printingId, marketplace) ?? latestPrice(marketplace);

    chips.push({ marketplace, value: value ?? null, url });
  }

  return chips;
}

interface PriceTableProps {
  selected: Marketplace;
  onSelect: (marketplace: Marketplace) => void;
  hideHeading?: boolean;
}

export function PriceTable({
  printing,
  keepEmptyRows,
  ...rowProps
}: PriceTableProps & { printing: Printing; keepEmptyRows?: boolean }) {
  const entries = usePriceEntries(printing, "30d");
  const shown = keepEmptyRows ? entries : entries.filter((entry) => entry.value !== null);
  if (shown.length === 0) {
    return null;
  }
  return <PriceRows entries={shown} {...rowProps} />;
}

export function PriceTablePlaceholder(props: PriceTableProps) {
  const marketplaceOrder = useDisplayStore((s) => s.marketplaceOrder);
  const entries = marketplaceOrder.map((marketplace) => ({ marketplace, value: null, url: null }));
  return <PriceRows entries={entries} {...props} />;
}

function PriceRows({
  entries,
  selected,
  onSelect,
  hideHeading,
}: PriceTableProps & { entries: PriceEntry[] }) {
  return (
    <section className="space-y-2">
      {!hideHeading && <SectionHeading as="h3">{m.card_detail_prices_title()}</SectionHeading>}
      <ul className="divide-border overflow-hidden rounded-lg border">
        {entries.map(({ marketplace, value, url }) => {
          const links = MARKETPLACE_LINKS[marketplace];
          const isSelected = marketplace === selected;
          return (
            <li
              key={marketplace}
              className={cn(
                "flex h-10 items-center gap-2 border-t pr-1.5 first:border-t-0",
                isSelected && "bg-muted",
              )}
            >
              <Pressable
                aria-pressed={isSelected}
                onClick={() => onSelect(marketplace)}
                className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-3 text-left"
              >
                <MarketplaceIcon marketplace={marketplace} alt="" />
                <span className={cn("flex-1 truncate", !isSelected && "text-muted-foreground")}>
                  {links.label}
                </span>
                <span className={cn("font-semibold tabular-nums", priceColorClass(value))}>
                  {value === null ? formatPrice() : formatterForMarketplace(marketplace)(value)}
                </span>
              </Pressable>
              {url && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="xs"
                        className="shrink-0"
                        render={
                          <MarketplaceLink
                            marketplace={marketplace}
                            href={url}
                            aria-label={m.card_detail_buy_on_marketplace({
                              marketplace: links.label,
                            })}
                          />
                        }
                      />
                    }
                  >
                    {m.card_detail_buy()}
                    <ArrowUpRightIcon />
                  </TooltipTrigger>
                  <TooltipContent>
                    {m.card_detail_buy_on_marketplace({ marketplace: links.label })}
                    {links.isAffiliate && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        {m.card_detail_affiliate_note()}
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
