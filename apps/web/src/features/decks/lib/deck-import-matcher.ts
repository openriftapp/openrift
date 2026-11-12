import { legendDisplayName } from "@openrift/shared/card-name";
import { primaryCardType } from "@openrift/shared/card-primary-type";
import type { CardResolution, CardSearchIndex, CodeIndex } from "@openrift/shared/card-search";
import { buildCodeIndex, lookupCode, resolveCard } from "@openrift/shared/card-search";
import type { DeckImportEntry } from "@openrift/shared/deck-code";
import type { Printing } from "@openrift/shared/types/catalog";
import type { CardType, DeckZone, Domain, SuperType } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { inferZone } from "@openrift/shared/zone-inference";

import type { CardSearchRow } from "@/features/cards/lib/card-lookup-rows";
import { cardLookupIndex } from "@/features/cards/lib/card-lookup-rows";

export type DeckMatchStatus = "exact" | "needs-review" | "unresolved";

export interface ResolvedCard {
  cardId: string;
  displayName: string;
  cardType: CardType;
  cardTypes: CardType[];
  superTypes: SuperType[];
  domains: Domain[];
  shortCode: string;
  preferredPrintingId: string | null;
}

export interface DeckMatchedEntry {
  entry: DeckImportEntry;
  status: DeckMatchStatus;
  resolvedCard: ResolvedCard | null;
  candidates: ResolvedCard[];
  suggestedName?: string;
  zone: DeckZone;
}

class CardIndex {
  private readonly byCode: CodeIndex<ResolvedCard, Printing>;
  private readonly nameIndex: CardSearchIndex<CardSearchRow>;

  constructor(allPrintings: Printing[]) {
    this.byCode = buildCodeIndex(
      allPrintings.map((printing) => ({ card: resolvedCardFromPrinting(printing), printing })),
    );
    this.nameIndex = cardLookupIndex(allPrintings);
  }

  /** `preferredPrintingId` is always null: deck-code formats encode card identity, not printing identity. */
  lookupByCode(shortCode: string): ResolvedCard | null {
    return lookupCode(this.byCode, shortCode)?.card ?? null;
  }

  resolveName(cardName: string): CardResolution<CardSearchRow> {
    return resolveCard(this.nameIndex, cardName);
  }
}

export function resolvedCardFromPrinting(printing: Printing): ResolvedCard {
  return {
    cardId: printing.cardId,
    displayName: legendDisplayName(printing.card),
    cardType: primaryCardType(printing.card.types),
    cardTypes: printing.card.types,
    superTypes: printing.card.superTypes,
    domains: printing.card.domains,
    shortCode: printing.shortCode,
    preferredPrintingId: null,
  };
}

function inferEntryZone(entry: DeckImportEntry, card: ResolvedCard | null): DeckZone {
  if (entry.explicitZone) {
    return entry.explicitZone;
  }
  if (!card) {
    return entry.sourceSlot === "sideboard"
      ? WellKnown.deckZone.SIDEBOARD
      : entry.sourceSlot === "chosenChampion"
        ? WellKnown.deckZone.CHAMPION
        : WellKnown.deckZone.MAIN;
  }

  return inferZone(card.cardTypes, card.superTypes, entry.sourceSlot);
}

export function matchDeckEntries(
  entries: DeckImportEntry[],
  allPrintings: Printing[],
): DeckMatchedEntry[] {
  const index = new CardIndex(allPrintings);
  const matched = entries.map((entry) => matchSingleDeckEntry(entry, index));

  // Skip entries with an explicit zone (e.g. a "Legend:" header): promoting
  // one would silently override the user's own zone choice.
  const hasExplicitChampion = matched.some(
    (m) => m.entry.explicitZone === WellKnown.deckZone.CHAMPION,
  );
  if (!hasExplicitChampion) {
    const firstChampion = matched.find(
      (m) =>
        m.resolvedCard?.superTypes.includes(WellKnown.superType.CHAMPION) &&
        m.zone !== WellKnown.deckZone.SIDEBOARD &&
        !m.entry.explicitZone,
    );
    if (firstChampion) {
      firstChampion.zone = WellKnown.deckZone.CHAMPION;
      if (firstChampion.entry.quantity > 1) {
        const originalEntry = firstChampion.entry;
        const remainingQuantity = originalEntry.quantity - 1;
        firstChampion.entry = { ...originalEntry, quantity: 1 };
        const remainingEntry = {
          ...originalEntry,
          quantity: remainingQuantity,
          explicitZone: undefined,
        };
        matched.splice(matched.indexOf(firstChampion) + 1, 0, {
          entry: remainingEntry,
          status: firstChampion.status,
          resolvedCard: firstChampion.resolvedCard,
          candidates: firstChampion.candidates,
          suggestedName: firstChampion.suggestedName,
          zone: inferEntryZone(remainingEntry, firstChampion.resolvedCard),
        });
      }
    }
  }

  return matched;
}

function matchSingleDeckEntry(entry: DeckImportEntry, index: CardIndex): DeckMatchedEntry {
  if (entry.shortCode) {
    const card = index.lookupByCode(entry.shortCode);
    if (card) {
      return {
        entry,
        status: "exact",
        resolvedCard: card,
        candidates: [card],
        zone: inferEntryZone(entry, card),
      };
    }
  }

  if (entry.cardName) {
    const resolution = index.resolveName(entry.cardName);
    if (resolution.status === "matched") {
      const card = resolvedCardFromPrinting(resolution.card.printing);
      return {
        entry,
        status: "exact",
        resolvedCard: card,
        candidates: [card],
        zone: inferEntryZone(entry, card),
      };
    }
    if (resolution.status === "ambiguous") {
      const candidates = resolution.candidates.map((row) => resolvedCardFromPrinting(row.printing));
      const first = candidates[0] as ResolvedCard;
      return {
        entry,
        status: "needs-review",
        resolvedCard: first,
        candidates,
        suggestedName: first.displayName,
        zone: inferEntryZone(entry, first),
      };
    }
  }

  return {
    entry,
    status: "unresolved",
    resolvedCard: null,
    candidates: [],
    zone: inferEntryZone(entry, null),
  };
}
