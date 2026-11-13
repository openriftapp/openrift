import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";

import { ValueWithUnpriced } from "@/features/cards/components/value-with-unpriced";
import { useCardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { useCards } from "@/features/cards/hooks/use-cards";
import { computeListValue } from "@/features/lists/lib/list-value";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { formatterForMarketplace } from "@/lib/format";

interface ListValueLabelProps {
  kind: ListKind;
  entries: readonly ListEntryDetailResponse[];
}

/** SSR-unsafe via the `useSuspenseQuery` hooks below; consumers gate mount with `useHydrated()`. */
export function ListValueLabel({ kind, entries }: ListValueLabelProps) {
  const display = useCardThumbnailDisplay();
  const { printingsByCardId } = useCards();
  const languages = useEffectiveLanguageOrder();

  const { value, unpriced } = computeListValue({
    entries,
    prices: display.prices,
    marketplace: display.favoriteMarketplace,
    printingsByCardId: kind === "card" ? printingsByCardId : EMPTY_MAP,
    languages,
  });

  const format = formatterForMarketplace(display.favoriteMarketplace);

  return <ValueWithUnpriced value={format(value)} unpriced={unpriced} className="shrink-0" />;
}

const EMPTY_MAP: ReadonlyMap<string, Printing[]> = new Map();
