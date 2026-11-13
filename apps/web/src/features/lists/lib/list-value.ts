import { cheapestPricedPrinting, priceTotal } from "@openrift/shared/card-price";
import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { PriceLookup } from "@openrift/shared/types/api/pricing";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Marketplace } from "@openrift/shared/types/pricing";

interface ComputeListValueInput {
  entries: readonly ListEntryDetailResponse[];
  prices: PriceLookup;
  marketplace: Marketplace;
  printingsByCardId: ReadonlyMap<string, readonly Printing[]>;
  languages: readonly string[];
}

export function computeListValue(input: ComputeListValueInput): {
  value: number;
  unpriced: number;
} {
  const { entries, prices, marketplace, printingsByCardId, languages } = input;
  const { value, unpriced } = priceTotal(
    entries.map((entry) => ({
      price:
        entry.kind === "card"
          ? cheapestPricedPrinting(
              printingsByCardId.get(entry.cardId) ?? [],
              prices,
              marketplace,
              languages,
            )?.price
          : prices.get(entry.printingId, marketplace),
      quantity: entry.quantity,
    })),
  );
  return { value, unpriced };
}
