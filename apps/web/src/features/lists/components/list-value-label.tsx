import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";

import { ValueWithUnpriced } from "@/features/cards/components/value-with-unpriced";
import { useCardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { useCards } from "@/features/cards/hooks/use-cards";
import { filterPrintingsByLanguages } from "@/features/cards/lib/filter-printings-by-languages";
import { computeListValue } from "@/features/lists/lib/list-value";
import { formatterForMarketplace } from "@/lib/format";
import { useDisplayStore } from "@/stores/display-store";

interface ListValueLabelProps {
  kind: ListKind;
  entries: readonly ListEntryDetailResponse[];
}

/** SSR-unsafe via the `useSuspenseQuery` hooks below; consumers gate mount with `useHydrated()`. */
export function ListValueLabel({ kind, entries }: ListValueLabelProps) {
  const display = useCardThumbnailDisplay();
  const { printingsByCardId } = useCards();
  const userLanguages = useDisplayStore((state) => state.languages);

  const scopedPrintingsByCardId =
    kind === "card" ? filterPrintingsByLanguages(printingsByCardId, userLanguages) : EMPTY_MAP;

  const { value, unpriced } = computeListValue({
    entries,
    prices: display.prices,
    marketplace: display.favoriteMarketplace,
    printingsByCardId: scopedPrintingsByCardId,
  });

  const format = formatterForMarketplace(display.favoriteMarketplace);

  return <ValueWithUnpriced value={format(value)} unpriced={unpriced} className="shrink-0" />;
}

const EMPTY_MAP: ReadonlyMap<string, Printing[]> = new Map();
