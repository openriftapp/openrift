import type { TradeMarketCard, TradeMarketSource } from "./trade-market";
import { filterMarketByPerson } from "./trade-market";

export interface FinderPerson extends TradeMarketSource {
  get: TradeMarketCard[];
  give: TradeMarketCard[];
}

export function finderPeople(
  incoming: readonly TradeMarketCard[],
  outgoing: readonly TradeMarketCard[],
): FinderPerson[] {
  const sources = new Map<string, TradeMarketSource>();
  for (const card of [...incoming, ...outgoing]) {
    for (const source of card.sources) {
      if (!sources.has(source.userId)) {
        sources.set(source.userId, source);
      }
    }
  }
  return [...sources.values()]
    .map((source) => ({
      ...source,
      get: filterMarketByPerson(incoming, source.userId),
      give: filterMarketByPerson(outgoing, source.userId),
    }))
    .toSorted(
      (a, b) =>
        b.get.length + b.give.length - (a.get.length + a.give.length) ||
        b.get.length - a.get.length ||
        (a.name ?? "").localeCompare(b.name ?? ""),
    );
}
