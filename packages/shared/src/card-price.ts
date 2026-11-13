import type { PriceLookup } from "./types/api/pricing.js";
import type { Marketplace } from "./types/pricing.js";

interface PricedPrinting<P> {
  printing: P;
  price: number;
}

function cheapestIn<P extends { printingId: string }>(
  printings: readonly P[],
  prices: PriceLookup,
  marketplace: Marketplace,
): PricedPrinting<P> | undefined {
  let best: PricedPrinting<P> | undefined;
  for (const printing of printings) {
    const price = prices.get(printing.printingId, marketplace);
    if (price === undefined) {
      continue;
    }
    if (
      best === undefined ||
      price < best.price ||
      (price === best.price && printing.printingId < best.printing.printingId)
    ) {
      best = { printing, price };
    }
  }
  return best;
}

export function cheapestPricedPrinting<P extends { printingId: string; language: string }>(
  printings: readonly P[],
  prices: PriceLookup,
  marketplace: Marketplace,
  languages: readonly string[],
): PricedPrinting<P> | undefined {
  const preferred = printings.filter((printing) => languages.includes(printing.language));
  return cheapestIn(preferred, prices, marketplace) ?? cheapestIn(printings, prices, marketplace);
}

export function cheapestPriceByCard<P extends { printingId: string; language: string }>(
  printingsByCardId: ReadonlyMap<string, readonly P[]>,
  prices: PriceLookup,
  marketplace: Marketplace,
  languages: readonly string[],
): Map<string, number> {
  const cheapest = new Map<string, number>();
  for (const [cardId, printings] of printingsByCardId) {
    const priced = cheapestPricedPrinting(printings, prices, marketplace, languages);
    if (priced !== undefined) {
      cheapest.set(cardId, priced.price);
    }
  }
  return cheapest;
}

export interface PriceTotal {
  value: number;
  priced: number;
  unpriced: number;
}

const EMPTY_PRICE_TOTAL: PriceTotal = { value: 0, priced: 0, unpriced: 0 };

function addToPriceTotal(
  total: PriceTotal,
  price: number | undefined,
  quantity: number,
): PriceTotal {
  if (price === undefined) {
    return { ...total, unpriced: total.unpriced + quantity };
  }
  return {
    value: total.value + price * quantity,
    priced: total.priced + quantity,
    unpriced: total.unpriced,
  };
}

export function priceTotal(
  rows: Iterable<{ price: number | undefined; quantity: number }>,
): PriceTotal {
  let total = EMPTY_PRICE_TOTAL;
  for (const row of rows) {
    total = addToPriceTotal(total, row.price, row.quantity);
  }
  return total;
}
