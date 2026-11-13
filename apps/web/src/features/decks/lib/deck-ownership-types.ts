import type { Rarity } from "@openrift/shared/types/enums";

export interface OwnershipPrinting {
  id: string;
  sideKey: string;
  language: string;
  shortCode: string;
  otherSide?: { shortCode: string };
  setId: string;
  rarity: Rarity;
  imageId: string | undefined;
  landscape: boolean;
}

export interface CardOwnership {
  cardId: string;
  cardName: string;
  cardSlug: string | undefined;
  displayName: string;
  zone: string;
  needed: number;
  owned: number;
  shortfall: number;
  locked: number;
  lockedLoaned: number;
  lockedReserved: number;
  lockedExcluded: number;
  borrowed: number;
  incoming: number;
  displayPrice: number | undefined;
  displayPrinting: OwnershipPrinting | undefined;
  cheapestPrice: number | undefined;
  cheapestPrinting: OwnershipPrinting | undefined;
}

export interface DeckOwnershipData {
  byCardZone: Map<string, CardOwnership>;
  totalNeeded: number;
  totalOwned: number;
  requiredZoneNeeded: number;
  requiredZoneOwned: number;
  ownedPrintingByCardId: ReadonlyMap<string, OwnershipPrinting>;
  totalLocked: number;
  totalBorrowed: number;
  totalIncoming: number;
  missingCount: number;
  requiredZoneMissing: number;
  sideboardMissing: number;
  deckValue: number | undefined;
  mainValue: number | undefined;
  sideboardValue: number | undefined;
  asDisplayedValue: number | undefined;
  missingValue: number | undefined;
  missingAsDisplayedValue: number | undefined;
  unpricedCount: number;
  missingUnpricedCount: number;
  missingCards: CardOwnership[];
}
