import { copyLimitFor } from "@openrift/shared/deck-rules";
import type { PriceLookup } from "@openrift/shared/types/api/pricing";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { WellKnown } from "@openrift/shared/well-known";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import {
  COPY_LIMIT_ZONES,
  copyLimitTotal,
  deckCardKey,
  runeAddRoom,
} from "@/features/decks/lib/deck-builder-card";
import type { OwnershipBandSegments } from "@/features/decks/lib/deck-ownership-band";
import type { CardOwnership, DeckOwnershipData } from "@/features/decks/lib/deck-ownership-types";
import { formatterForMarketplace } from "@/lib/format";

export const STEPPER_ZONES: ReadonlySet<DeckZone> = new Set([
  WellKnown.deckZone.RUNES,
  WellKnown.deckZone.MAIN,
  WellKnown.deckZone.SIDEBOARD,
  WellKnown.deckZone.OVERFLOW,
]);

export const NO_BANDS: ReadonlyMap<string, OwnershipBandSegments> = new Map();

export const NO_PRICE_TEXTS: ReadonlyMap<string, string> = new Map();

export const NO_CARDS: DeckBuilderCard[] = [];

export const NO_ADD_ROOM: ReadonlyMap<string, number> = new Map();

// Must mirror the checks `addCardAction` makes.
export function buildAddRoom(cards: DeckBuilderCard[], format: DeckFormat): Map<string, number> {
  const room = new Map<string, number>();
  const freeform = format === WellKnown.deckFormat.FREEFORM;
  for (const card of cards) {
    const key = deckCardKey(card);
    if (freeform || !STEPPER_ZONES.has(card.zone)) {
      room.set(key, Number.POSITIVE_INFINITY);
      continue;
    }
    if (card.zone === WellKnown.deckZone.RUNES) {
      room.set(key, runeAddRoom(card, cards));
      continue;
    }
    if (COPY_LIMIT_ZONES.has(card.zone)) {
      room.set(key, Math.max(0, copyLimitFor(card) - copyLimitTotal(cards, card.cardId)));
      continue;
    }
    room.set(key, Number.POSITIVE_INFINITY);
  }
  return room;
}

// Must mirror the price resolution the list rows use.
export function buildPriceTexts(
  cards: DeckBuilderCard[],
  ownershipData: DeckOwnershipData,
  preferOwned: boolean,
  priceMap: PriceLookup | undefined,
  marketplace: Marketplace,
): Map<string, string> {
  const fmtPrice = formatterForMarketplace(marketplace);
  const texts = new Map<string, string>();
  for (const card of cards) {
    const owned = preferOwned ? ownershipData.ownedPrintingByCardId.get(card.cardId) : undefined;
    const entry = ownershipData.byCardZone.get(`${card.cardId}:${card.zone}`);
    const cents =
      owned && priceMap
        ? priceMap.get(owned.id, marketplace)
        : (entry?.cheapestPrice ?? entry?.displayPrice);
    if (cents !== undefined) {
      texts.set(deckCardKey(card), fmtPrice(cents));
    }
  }
  return texts;
}

export function expandCopies(
  cards: DeckBuilderCard[],
  showAllCopies: boolean,
): { card: DeckBuilderCard; copyIndex: number | null }[] {
  if (!showAllCopies) {
    return cards.map((card) => ({ card, copyIndex: null }));
  }
  return cards.flatMap((card): { card: DeckBuilderCard; copyIndex: number | null }[] =>
    card.quantity > 1
      ? Array.from({ length: card.quantity }, (_, copyIndex) => ({ card, copyIndex }))
      : [{ card, copyIndex: null }],
  );
}

export function zoneShowsAllCopies(
  zone: DeckZone,
  showAllCopies: boolean,
  showAllRuneCopies: boolean,
): boolean {
  return zone === WellKnown.deckZone.RUNES ? showAllCopies && showAllRuneCopies : showAllCopies;
}

export type CopyOwnershipStatus = "owned" | "borrowed" | "locked" | "missing";

export function copyOwnershipStatus(
  entry: Pick<CardOwnership, "owned" | "borrowed" | "locked">,
  copyIndex: number,
): CopyOwnershipStatus {
  if (copyIndex < entry.owned) {
    return "owned";
  }
  if (copyIndex < entry.owned + entry.borrowed) {
    return "borrowed";
  }
  if (copyIndex < entry.owned + entry.borrowed + entry.locked) {
    return "locked";
  }
  return "missing";
}

interface CopyView {
  printingId: string;
  thumbnail: string | undefined;
  priceText: string | undefined;
}

export type CopyViewFor = (card: DeckBuilderCard, copyIndex: number) => CopyView | undefined;
