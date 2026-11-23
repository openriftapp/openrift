import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { useId } from "react";

import { MarketplaceIcon } from "@/components/marketplace-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pressable } from "@/components/ui/pressable";
import { SectionHeading } from "@/components/ui/section-heading";
import { ValueWithUnpriced } from "@/features/cards/components/value-with-unpriced";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { MARKETPLACE_META } from "@/features/cards/lib/marketplace-meta";
import { computeListValueByMarketplace } from "@/features/lists/lib/list-value";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { formatterForMarketplace } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

interface ListValueLabelProps {
  kind: ListKind;
  entries: readonly ListEntryDetailResponse[];
}

/** SSR-unsafe via the `useSuspenseQuery` hooks below; consumers gate mount with `useHydrated()`. */
export function ListValueLabel({ kind, entries }: ListValueLabelProps) {
  const prices = usePrices();
  const { printingsByCardId } = useCards();
  const languages = useEffectiveLanguageOrder();
  const marketplaceOrder = useDisplayStore((state) => state.marketplaceOrder);
  const titleId = useId();

  const rows = computeListValueByMarketplace({
    entries,
    prices,
    marketplaces: marketplaceOrder,
    printingsByCardId: kind === "card" ? printingsByCardId : EMPTY_MAP,
    languages,
  }).map((row) => ({ ...row, value: formatterForMarketplace(row.marketplace)(row.value) }));
  const [favorite] = rows;
  if (!favorite) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Pressable className="flex shrink-0 items-baseline gap-1 rounded-sm" />}
      >
        <MarketplaceIcon marketplace={favorite.marketplace} className="self-center" />
        <span className="text-muted-foreground sr-only text-xs sm:not-sr-only">
          {MARKETPLACE_META[favorite.marketplace].label}
        </span>
        <ValueWithUnpriced value={favorite.value} unpriced={favorite.unpriced} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-2 p-3" aria-labelledby={titleId}>
        <SectionHeading as="h3" id={titleId}>
          {m.lists_value_by_marketplace()}
        </SectionHeading>
        <dl className="grid grid-cols-[auto_auto] items-baseline gap-x-4 gap-y-1.5 text-sm">
          {rows.map((row) => (
            <div key={row.marketplace} className="contents">
              <dt
                className={cn(
                  "flex items-center gap-2",
                  row.marketplace !== favorite.marketplace && "text-muted-foreground",
                )}
              >
                <MarketplaceIcon marketplace={row.marketplace} />
                {MARKETPLACE_META[row.marketplace].label}
              </dt>
              <dd className="text-right tabular-nums">
                {row.value}
                {row.unpriced > 0 && (
                  <span className="text-muted-foreground/60 ml-1 text-xs">
                    {m.common_unpriced({ count: row.unpriced })}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

const EMPTY_MAP: ReadonlyMap<string, Printing[]> = new Map();
