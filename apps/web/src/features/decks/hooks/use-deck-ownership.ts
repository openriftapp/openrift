import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { REQUIRED_ZONES, isCountedZone } from "@openrift/shared/deck-zones";
import { preferredPrinting } from "@openrift/shared/printing-select";
import { ownedTotalsByCard, sideKey } from "@openrift/shared/printing-side";
import type { PriceLookup } from "@openrift/shared/types/api/pricing";
import type { Printing } from "@openrift/shared/types/catalog";
import type { DeckZone } from "@openrift/shared/types/enums";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { WellKnown } from "@openrift/shared/well-known";

import { usePrices } from "@/features/cards/hooks/use-prices";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type {
  CardOwnership,
  DeckOwnershipData,
  OwnershipPrinting,
} from "@/features/decks/lib/deck-ownership-types";
import { coveredByPairPartner } from "@/features/decks/lib/pair-copy-cover";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";

function toOwnershipPrinting(printing: Printing): OwnershipPrinting {
  return {
    id: printing.printingId,
    sideKey: sideKey(printing),
    language: printing.language,
    shortCode: printing.shortCode,
    otherSide: printing.otherSide && { shortCode: printing.otherSide.shortCode },
    setId: printing.setId,
    rarity: printing.rarity,
    imageId: printing.images[0]?.imageId,
    landscape: getOrientation(printing.card.types) === "landscape",
  };
}

// Only meaningful when `entry.locked > 0`.
export function lockedReasonText(entry: CardOwnership): string {
  const reasons: string[] = [];
  if (entry.lockedLoaned > 0) {
    reasons.push("out on loan");
  }
  if (entry.lockedReserved > 0) {
    reasons.push("reserved for a trade");
  }
  if (entry.lockedExcluded > 0) {
    reasons.push("in a collection excluded from deck building");
  }
  const why = reasons.length > 0 ? reasons.join(" or ") : "unavailable for deck building";
  return entry.locked === 1
    ? `1 more copy is locked: ${why}`
    : `${entry.locked} more copies are locked: ${why}`;
}

const REQUIRED_ZONE_SET: ReadonlySet<DeckZone> = new Set(REQUIRED_ZONES);

export function computeDeckOwnership(
  deckCards: DeckBuilderCard[],
  allPrintings: Printing[],
  ownedCountByPrinting: Record<string, number> | undefined,
  marketplace: Marketplace,
  prices: PriceLookup,
  languageOrder: readonly string[],
  lockedCountByPrinting?: Record<string, number>,
  borrowedCountByPrinting?: Record<string, number>,
  lockedReasonCountByPrinting?: {
    loaned: Record<string, number>;
    reserved: Record<string, number>;
    excluded: Record<string, number>;
  },
  incomingCountByPrinting?: Record<string, number>,
): DeckOwnershipData {
  // Intentionally NOT `"use memo"`: wrapping this in a compiler cache check
  // shifts every later memoCache slot in the parent fiber, causing "previous
  // cache allocated with size X but size Y was requested" warnings.

  const printingsByCardId = new Map<string, Printing[]>();
  for (const printing of allPrintings) {
    const bucket = printingsByCardId.get(printing.cardId);
    if (bucket) {
      bucket.push(printing);
    } else {
      printingsByCardId.set(printing.cardId, [printing]);
    }
  }

  const ownedByCardId = ownedCountByPrinting
    ? ownedTotalsByCard(allPrintings, ownedCountByPrinting)
    : new Map<string, number>();

  const lockedByCardId = lockedCountByPrinting
    ? ownedTotalsByCard(allPrintings, lockedCountByPrinting)
    : new Map<string, number>();

  const borrowedByCardId = borrowedCountByPrinting
    ? ownedTotalsByCard(allPrintings, borrowedCountByPrinting)
    : new Map<string, number>();

  const incomingByCardId = incomingCountByPrinting
    ? ownedTotalsByCard(allPrintings, incomingCountByPrinting)
    : new Map<string, number>();

  const loanedByCardId = lockedReasonCountByPrinting?.loaned
    ? ownedTotalsByCard(allPrintings, lockedReasonCountByPrinting.loaned)
    : new Map<string, number>();

  const reservedByCardId = lockedReasonCountByPrinting?.reserved
    ? ownedTotalsByCard(allPrintings, lockedReasonCountByPrinting.reserved)
    : new Map<string, number>();

  const excludedByCardId = lockedReasonCountByPrinting?.excluded
    ? ownedTotalsByCard(allPrintings, lockedReasonCountByPrinting.excluded)
    : new Map<string, number>();

  // Claims are tracked per zone in iteration order; locked copies use a separate tracker.
  const claimedByCardId = new Map<string, number>();
  const claimedLockedByCardId = new Map<string, number>();
  const claimedBorrowedByCardId = new Map<string, number>();
  const claimedIncomingByCardId = new Map<string, number>();

  const byCardZone = new Map<string, CardOwnership>();
  const ownedPrintingByCardId = new Map<string, OwnershipPrinting>();
  const missingCards: CardOwnership[] = [];
  let totalNeeded = 0;
  let totalOwned = 0;
  let requiredZoneNeeded = 0;
  let requiredZoneOwned = 0;
  let totalLocked = 0;
  let totalBorrowed = 0;
  let totalIncoming = 0;
  let missingCount = 0;
  let requiredZoneMissing = 0;
  let sideboardMissing = 0;
  let hasPrices = false;
  let deckValueCents = 0;
  let asDisplayedValueCents = 0;
  let mainValueCents = 0;
  let sideboardValueCents = 0;
  let missingValueCents = 0;
  let missingMainValueCents = 0;
  let missingSideboardValueCents = 0;
  let missingAsDisplayedValueCents = 0;

  const valued: {
    zone: DeckZone;
    cardId: string;
    quantity: number;
    shortfall: number;
    valuePerCopy: number | undefined;
    valuePrintingId: string | undefined;
    displayPrice: number | undefined;
    displayPrintingId: string | undefined;
  }[] = [];

  // Overflow rows must be processed after every other zone.
  const orderedCards = deckCards.toSorted(
    (left, right) => Number(isCountedZone(right.zone)) - Number(isCountedZone(left.zone)),
  );

  for (const card of orderedCards) {
    const counted = isCountedZone(card.zone);
    const totalOwnedForCard = ownedByCardId.get(card.cardId) ?? 0;
    const alreadyClaimed = claimedByCardId.get(card.cardId) ?? 0;
    const availableForZone = Math.max(0, totalOwnedForCard - alreadyClaimed);
    const ownedInZone = Math.min(card.quantity, availableForZone);

    claimedByCardId.set(card.cardId, alreadyClaimed + ownedInZone);

    const totalBorrowedForCard = borrowedByCardId.get(card.cardId) ?? 0;
    const alreadyClaimedBorrowed = claimedBorrowedByCardId.get(card.cardId) ?? 0;
    const borrowedAvailableForZone = Math.max(0, totalBorrowedForCard - alreadyClaimedBorrowed);
    const borrowedInZone = Math.min(card.quantity - ownedInZone, borrowedAvailableForZone);
    claimedBorrowedByCardId.set(card.cardId, alreadyClaimedBorrowed + borrowedInZone);

    const shortfall = card.quantity - ownedInZone - borrowedInZone;

    // Capped at the remaining shortfall.
    const totalLockedForCard = lockedByCardId.get(card.cardId) ?? 0;
    const alreadyClaimedLocked = claimedLockedByCardId.get(card.cardId) ?? 0;
    const lockedAvailableForZone = Math.max(0, totalLockedForCard - alreadyClaimedLocked);
    const lockedInZone = Math.min(shortfall, lockedAvailableForZone);
    claimedLockedByCardId.set(card.cardId, alreadyClaimedLocked + lockedInZone);

    // Locked and incoming are disjoint physical cards: incoming caps against
    // what `locked` hasn't already claimed.
    const totalIncomingForCard = incomingByCardId.get(card.cardId) ?? 0;
    const alreadyClaimedIncoming = claimedIncomingByCardId.get(card.cardId) ?? 0;
    const incomingAvailableForZone = Math.max(0, totalIncomingForCard - alreadyClaimedIncoming);
    const incomingInZone = Math.min(shortfall - lockedInZone, incomingAvailableForZone);
    claimedIncomingByCardId.set(card.cardId, alreadyClaimedIncoming + incomingInZone);

    // Mirrors `usePreferredPrinting`: explicit pin first, then
    // language-preference canonical fallback.
    const candidates = printingsByCardId.get(card.cardId) ?? [];

    if (!ownedPrintingByCardId.has(card.cardId) && ownedCountByPrinting) {
      const ownedCandidates = candidates.filter(
        (candidate) => (ownedCountByPrinting[candidate.printingId] ?? 0) > 0,
      );
      const bestOwned = preferredPrinting(ownedCandidates, languageOrder);
      if (bestOwned) {
        ownedPrintingByCardId.set(card.cardId, toOwnershipPrinting(bestOwned));
      }
    }

    let resolvedPrinting: Printing | undefined;
    if (card.preferredPrintingId) {
      resolvedPrinting = candidates.find((p) => p.printingId === card.preferredPrintingId);
    }
    if (!resolvedPrinting) {
      resolvedPrinting = preferredPrinting(candidates, languageOrder);
    }

    const displayPrice = resolvedPrinting
      ? prices.get(resolvedPrinting.printingId, marketplace)
      : undefined;
    const displayPrinting = resolvedPrinting ? toOwnershipPrinting(resolvedPrinting) : undefined;

    let cheapestPrice: number | undefined;
    let cheapestResolved: Printing | undefined;
    {
      const pools = [
        candidates.filter((candidate) => languageOrder.includes(candidate.language)),
        candidates,
      ];
      for (const pool of pools) {
        for (const candidate of pool) {
          const price = prices.get(candidate.printingId, marketplace);
          if (price !== undefined && (cheapestPrice === undefined || price < cheapestPrice)) {
            cheapestPrice = price;
            cheapestResolved = candidate;
          }
        }
        if (cheapestPrice !== undefined) {
          break;
        }
      }
    }
    const cheapestPrinting = cheapestResolved ? toOwnershipPrinting(cheapestResolved) : undefined;

    const entry: CardOwnership = {
      cardId: card.cardId,
      cardName: card.cardName,
      cardSlug: resolvedPrinting?.card.slug,
      displayName: legendDisplayName({
        name: card.cardName,
        types: card.cardTypes,
        tags: card.tags,
      }),
      zone: card.zone,
      needed: card.quantity,
      owned: ownedInZone,
      shortfall,
      locked: lockedInZone,
      lockedLoaned: loanedByCardId.get(card.cardId) ?? 0,
      lockedReserved: reservedByCardId.get(card.cardId) ?? 0,
      lockedExcluded: excludedByCardId.get(card.cardId) ?? 0,
      borrowed: borrowedInZone,
      incoming: incomingInZone,
      displayPrice,
      displayPrinting,
      cheapestPrice,
      cheapestPrinting,
    };

    byCardZone.set(`${card.cardId}:${card.zone}`, entry);

    if (!counted) {
      continue;
    }

    totalNeeded += card.quantity;
    totalOwned += ownedInZone;
    totalLocked += lockedInZone;
    totalBorrowed += borrowedInZone;
    totalIncoming += incomingInZone;
    if (REQUIRED_ZONE_SET.has(card.zone)) {
      requiredZoneNeeded += card.quantity;
      requiredZoneOwned += ownedInZone;
    }

    if (shortfall > 0) {
      missingCount += shortfall;
      if (REQUIRED_ZONE_SET.has(card.zone)) {
        requiredZoneMissing += shortfall;
      } else {
        sideboardMissing += shortfall;
      }
      missingCards.push(entry);
    }

    valued.push({
      zone: card.zone,
      cardId: card.cardId,
      quantity: card.quantity,
      shortfall,
      valuePerCopy: cheapestPrice ?? displayPrice,
      valuePrintingId:
        cheapestPrice === undefined ? resolvedPrinting?.printingId : cheapestResolved?.printingId,
      displayPrice,
      displayPrintingId: resolvedPrinting?.printingId,
    });
  }

  const priced = (
    rows: typeof valued,
    printingOf: (row: (typeof valued)[number]) => string | undefined,
    amountOf: (row: (typeof valued)[number]) => number,
  ) =>
    coveredByPairPartner(
      rows.map((row) => ({
        cardId: row.cardId,
        printingId: printingOf(row),
        amount: amountOf(row),
      })),
    );
  const valueCovered = priced(
    valued,
    (row) => row.valuePrintingId,
    (row) => row.quantity,
  );
  const missingCovered = priced(
    valued,
    (row) => row.valuePrintingId,
    (row) => row.shortfall,
  );
  const displayCovered = priced(
    valued,
    (row) => row.displayPrintingId,
    (row) => row.quantity,
  );
  const displayMissingCovered = priced(
    valued,
    (row) => row.displayPrintingId,
    (row) => row.shortfall,
  );
  valued.forEach((row, index) => {
    const { valuePerCopy, displayPrice } = row;
    if (valuePerCopy !== undefined) {
      hasPrices = true;
      const value = valueCovered[index] ? 0 : valuePerCopy * row.quantity;
      const missing = missingCovered[index] ? 0 : valuePerCopy * row.shortfall;
      deckValueCents += value;
      if (row.zone === WellKnown.deckZone.SIDEBOARD) {
        sideboardValueCents += value;
        missingSideboardValueCents += missing;
      } else {
        mainValueCents += value;
        missingMainValueCents += missing;
      }
      missingValueCents += missing;
    }
    if (displayPrice !== undefined) {
      hasPrices = true;
      asDisplayedValueCents += displayCovered[index] ? 0 : displayPrice * row.quantity;
      missingAsDisplayedValueCents += displayMissingCovered[index]
        ? 0
        : displayPrice * row.shortfall;
    }
  });

  return {
    byCardZone,
    totalNeeded,
    totalOwned,
    requiredZoneNeeded,
    requiredZoneOwned,
    ownedPrintingByCardId,
    totalLocked,
    totalBorrowed,
    totalIncoming,
    missingCount,
    requiredZoneMissing,
    sideboardMissing,
    deckValueCents: hasPrices ? deckValueCents : undefined,
    mainValueCents: hasPrices ? mainValueCents : undefined,
    sideboardValueCents: hasPrices ? sideboardValueCents : undefined,
    asDisplayedValueCents: hasPrices ? asDisplayedValueCents : undefined,
    missingValueCents: hasPrices ? missingValueCents : undefined,
    missingMainValueCents: hasPrices ? missingMainValueCents : undefined,
    missingSideboardValueCents: hasPrices ? missingSideboardValueCents : undefined,
    missingAsDisplayedValueCents: hasPrices ? missingAsDisplayedValueCents : undefined,
    missingCards,
  };
}

export function useDeckOwnership(
  deckCards: DeckBuilderCard[],
  allPrintings: Printing[],
  ownedCountByPrinting: Record<string, number> | undefined,
  marketplace: Marketplace,
  lockedCountByPrinting?: Record<string, number>,
  borrowedCountByPrinting?: Record<string, number>,
  lockedReasonCountByPrinting?: {
    loaned: Record<string, number>;
    reserved: Record<string, number>;
    excluded: Record<string, number>;
  },
  incomingCountByPrinting?: Record<string, number>,
): DeckOwnershipData | undefined {
  const prices = usePrices();
  const languageOrder = useEffectiveLanguageOrder();
  if (!ownedCountByPrinting) {
    return undefined;
  }
  return computeDeckOwnership(
    deckCards,
    allPrintings,
    ownedCountByPrinting,
    marketplace,
    prices,
    languageOrder,
    lockedCountByPrinting,
    borrowedCountByPrinting,
    lockedReasonCountByPrinting,
    incomingCountByPrinting,
  );
}
