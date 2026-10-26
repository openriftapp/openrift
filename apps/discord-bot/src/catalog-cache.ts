import type { CardStatLabels } from "@openrift/shared/card-stat-line";
import { catalogRefResolver, catalogValueSides } from "@openrift/shared/catalog-join";
import { enumLabelsFromInit } from "@openrift/shared/enum-label";
import type { VariantLabelEnumLabels } from "@openrift/shared/printing-label";
import type {
  CatalogResponse,
  CatalogResponseCardValue,
  CatalogResponsePrintingValue,
  CatalogSetResponse,
} from "@openrift/shared/types/api/catalog";
import type { InitResponse } from "@openrift/shared/types/api/init";
import type { PricesResponse } from "@openrift/shared/types/api/pricing";
import type { Marker, PrintingDistributionChannel } from "@openrift/shared/types/catalog";

export type CatalogCard = CatalogResponseCardValue & { id: string };
/** One printed side; a double-sided printing contributes an entry to each of its cards. */
export type CatalogPrinting = Omit<
  CatalogResponsePrintingValue,
  "side2" | "markers" | "distributionChannels"
> & {
  printingId: string;
  side: 1 | 2;
  markers: Marker[];
  distributionChannels: PrintingDistributionChannel[];
  otherSide?: { cardName: string; shortCode: string };
};

export interface EnumLabels extends VariantLabelEnumLabels, CardStatLabels {
  deckZones: Record<string, string>;
}

export interface CatalogSnapshot {
  cards: CatalogCard[];
  printingsByCardId: Map<string, CatalogPrinting[]>;
  setsById: Map<string, CatalogSetResponse>;
  prices: PricesResponse["prices"];
  currencies: PricesResponse["currencies"];
  labels: EnumLabels;
  zoneOrder: string[];
}

interface CatalogFetchers {
  fetchCatalog: () => Promise<CatalogResponse>;
  fetchInit: () => Promise<InitResponse>;
  fetchPrices: () => Promise<PricesResponse>;
}

export function buildSnapshot(
  catalog: CatalogResponse,
  prices: PricesResponse,
  init: InitResponse,
): CatalogSnapshot {
  const cards = Object.entries(catalog.cards).map(([id, card]) => ({ id, ...card }));
  const resolve = catalogRefResolver(catalog);
  const allSides: CatalogPrinting[] = [];
  for (const [printingId, value] of Object.entries(catalog.printings)) {
    const sides: CatalogPrinting[] = catalogValueSides(printingId, value).map((side, index) => ({
      ...side,
      markers: resolve.markers(side.markers),
      distributionChannels: resolve.channels(side.distributionChannels),
      printingId,
      side: index === 0 ? 1 : 2,
    }));
    if (sides.length === 2) {
      const [front, back] = sides as [CatalogPrinting, CatalogPrinting];
      front.otherSide = {
        cardName: catalog.cards[back.cardId]?.name ?? "",
        shortCode: back.shortCode,
      };
      back.otherSide = {
        cardName: catalog.cards[front.cardId]?.name ?? "",
        shortCode: front.shortCode,
      };
    }
    allSides.push(...sides);
  }
  const printingsByCardId = new Map<string, CatalogPrinting[]>();
  for (const side of allSides) {
    const list = printingsByCardId.get(side.cardId) ?? [];
    // A card on both sides is one printing of that card.
    if (!list.some((listed) => listed.printingId === side.printingId)) {
      list.push(side);
    }
    printingsByCardId.set(side.cardId, list);
  }
  for (const list of printingsByCardId.values()) {
    list.sort((a, b) => a.canonicalRank - b.canonicalRank);
  }
  return {
    cards,
    printingsByCardId,
    setsById: new Map(catalog.sets.map((set) => [set.id, set])),
    prices: prices.prices,
    currencies: prices.currencies,
    labels: enumLabelsFromInit(init.enums),
    zoneOrder: init.enums.deckZones
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => row.slug),
  };
}

export function representativePrinting(
  snapshot: CatalogSnapshot,
  cardId: string,
): CatalogPrinting | undefined {
  const printings = snapshot.printingsByCardId.get(cardId);
  if (!printings?.length) {
    return undefined;
  }
  return printings.find((p) => p.images.length > 0) ?? printings[0];
}

export class CatalogCache {
  readonly #fetchers: CatalogFetchers;
  #snapshot: CatalogSnapshot | null = null;

  constructor(fetchers: CatalogFetchers) {
    this.#fetchers = fetchers;
  }

  get snapshot(): CatalogSnapshot | null {
    return this.#snapshot;
  }

  /** Swaps the snapshot atomically; keeps the previous one if the fetch fails. */
  async refresh(): Promise<void> {
    const [catalog, prices, init] = await Promise.all([
      this.#fetchers.fetchCatalog(),
      this.#fetchers.fetchPrices(),
      this.#fetchers.fetchInit(),
    ]);
    this.#snapshot = buildSnapshot(catalog, prices, init);
  }
}
