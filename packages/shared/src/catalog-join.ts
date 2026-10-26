import { splitCardBans } from "./card-ban.js";
import { PRINTING_LEVEL_FIELDS } from "./catalog-printing-fields.js";
import type { PrintingLevelField } from "./catalog-printing-fields.js";
import { todayUtc } from "./format-date.js";
import { isReleasedIn } from "./set-release.js";
import type {
  CatalogPrintingChannelRef,
  CatalogPrintingResponse,
  CatalogResponse,
  CatalogResponsePrintingValue,
} from "./types/api/catalog.js";
import type {
  Card,
  CardBan,
  DistributionChannel,
  Marker,
  Printing,
  PrintingDistributionChannel,
  PrintingSide,
} from "./types/catalog.js";

export function joinCatalogCards<T extends { bans: CardBan[] }>(
  cards: Record<string, T>,
  today = todayUtc(),
): Record<string, T & Pick<Card, "upcomingBans">> {
  const joined: Record<string, T & Pick<Card, "upcomingBans">> = {};
  for (const [id, value] of Object.entries(cards)) {
    joined[id] = splitCardBans(value, today);
  }
  return joined;
}

export interface CatalogRefResolver {
  markers: (slugs: readonly string[]) => Marker[];
  channels: (refs: readonly CatalogPrintingChannelRef[]) => PrintingDistributionChannel[];
}

/** Resolves the slugs `/catalog` printings carry against the catalog's own definitions. Unknown slugs are dropped. */
export function catalogRefResolver(
  catalog: Pick<CatalogResponse, "markers" | "distributionChannels">,
): CatalogRefResolver {
  const markerBySlug = new Map(catalog.markers.map((marker) => [marker.slug, marker]));
  const channelBySlug = new Map(
    catalog.distributionChannels.map((channel) => [channel.slug, channel]),
  );
  const channelById = new Map(catalog.distributionChannels.map((channel) => [channel.id, channel]));
  const ancestorsById = new Map<string, string[]>();
  const ancestorLabels = (channel: DistributionChannel): string[] => {
    const cached = ancestorsById.get(channel.id);
    if (cached) {
      return cached;
    }
    const labels: string[] = [];
    let parent = channel.parentId === null ? undefined : channelById.get(channel.parentId);
    // Bounded like the server walk, so a cycle in the data cannot hang the join.
    for (let depth = 0; parent && depth < 32; depth += 1) {
      labels.unshift(parent.label);
      parent = parent.parentId === null ? undefined : channelById.get(parent.parentId);
    }
    ancestorsById.set(channel.id, labels);
    return labels;
  };
  return {
    markers: (slugs) => slugs.flatMap((slug) => markerBySlug.get(slug) ?? []),
    channels: (refs) =>
      refs.flatMap((ref) => {
        const channel = channelBySlug.get(ref.channel);
        return channel
          ? [
              {
                channel,
                distributionNote: ref.note ?? null,
                ancestorLabels: ancestorLabels(channel),
              },
            ]
          : [];
      }),
  };
}

export type CatalogValueSide = Omit<CatalogResponsePrintingValue, "side2" | "faceId"> & {
  faceId: string;
};

/** A `/catalog` value as its sides. Side 2 takes only the printing-level fields from side 1. */
export function catalogValueSides(
  printingId: string,
  value: CatalogResponsePrintingValue,
): CatalogValueSide[] {
  const { side2, faceId, ...rest } = value;
  const first = { ...rest, faceId: faceId ?? printingId };
  if (side2 === undefined) {
    return [first];
  }
  const printingFields = Object.fromEntries(
    PRINTING_LEVEL_FIELDS.filter((key) => key in rest).map((key) => [key, rest[key]]),
  ) as Pick<CatalogResponsePrintingValue, PrintingLevelField>;
  return [first, { ...printingFields, ...side2 }];
}

export function printingValueSides(
  printings: Record<string, CatalogResponsePrintingValue>,
): (CatalogValueSide & { printingId: string; side: PrintingSide })[] {
  return Object.entries(printings).flatMap(([printingId, value]) =>
    catalogValueSides(printingId, value).map((side, index) => ({
      ...side,
      printingId,
      side: index === 0 ? (1 as const) : (2 as const),
    })),
  );
}

type CatalogSlice = Pick<
  CatalogResponse,
  "sets" | "cards" | "printings" | "markers" | "distributionChannels"
>;

/**
 * The browser and the API both run `filterCards` over this result, so it has
 * to produce identical rows on both sides.
 */
export function joinCatalog(catalog: CatalogSlice): {
  cardsById: Record<string, Card>;
  printings: Printing[];
} {
  const setsById = new Map(catalog.sets.map((set) => [set.id, set]));
  // One "today" for the whole join, so two printings of a set, or a card and its
  // bans, cannot land on opposite sides of a midnight that passes mid-join.
  const today = todayUtc();
  const cardsById: Record<string, Card> = joinCatalogCards(catalog.cards, today);
  const resolve = catalogRefResolver(catalog);

  const printings: Printing[] = [];
  for (const [printingId, value] of Object.entries(catalog.printings)) {
    const sides = catalogValueSides(printingId, value);
    const cards = sides.map((side) => cardsById[side.cardId]);
    sides.forEach((side, index) => {
      const set = setsById.get(side.setId);
      const card = cards[index];
      if (!set || !card) {
        return;
      }
      const other = sides.length === 2 ? sides[1 - index] : undefined;
      const otherCard = sides.length === 2 ? cards[1 - index] : undefined;
      const otherImageId = other?.images[0]?.imageId;
      printings.push({
        ...side,
        markers: resolve.markers(side.markers),
        distributionChannels: resolve.channels(side.distributionChannels),
        printingId,
        side: index === 0 ? 1 : 2,
        ...(other && otherCard
          ? {
              otherSide: {
                faceId: other.faceId,
                cardId: other.cardId,
                cardName: otherCard.name,
                cardSlug: otherCard.slug,
                shortCode: other.shortCode,
                ...(otherImageId === undefined ? {} : { imageId: otherImageId }),
              },
            }
          : {}),
        setSlug: set.slug,
        setReleased: isReleasedIn(set.releases, side.language, today),
        card,
      });
    });
  }
  return { cardsById, printings };
}

/** Joins side entries from an array endpoint, which already carry their pairing. */
export function joinPrintingSides(
  entries: readonly CatalogPrintingResponse[],
  sets: CatalogResponse["sets"],
  cardsById: Record<string, Card>,
  today = todayUtc(),
): Printing[] {
  const setsById = new Map(sets.map((set) => [set.id, set]));
  const printings: Printing[] = [];
  for (const entry of entries) {
    const set = setsById.get(entry.setId);
    const card = cardsById[entry.cardId];
    if (set && card) {
      printings.push({
        ...entry,
        setSlug: set.slug,
        setReleased: isReleasedIn(set.releases, entry.language, today),
        card,
      });
    }
  }
  return printings;
}

export function joinCatalogPrintings(catalog: CatalogResponse): Printing[] {
  return joinCatalog(catalog).printings;
}
