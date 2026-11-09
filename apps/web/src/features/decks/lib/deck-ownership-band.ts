import { isCountedZone } from "@openrift/shared/deck-zones";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { getDeckCardKey } from "@/features/decks/lib/deck-builder-card";
import { m } from "@/paraglide/messages.js";

/**
 * The five numbers always sum to the entry's quantity. Locked copies still
 * count as missing in shortfall figures; borrowed copies count as buildable
 * and must not paint as missing.
 */
export interface OwnershipBandSegments {
  exact: number;
  other: number;
  borrowed: number;
  locked: number;
  missing: number;
}

/**
 * Fills exact, then other, then borrowed, then locked, in that order.
 * Borrowed must stay ahead of locked: only borrowed counts as buildable.
 */
export function ownershipBandSegments(
  quantity: number,
  ownedOfDisplayed: number,
  ownedOfOthers: number,
  borrowedOfCard = 0,
  lockedOfCard = 0,
): OwnershipBandSegments {
  const needed = Math.max(0, quantity);
  const exact = Math.min(needed, Math.max(0, ownedOfDisplayed));
  const other = Math.min(needed - exact, Math.max(0, ownedOfOthers));
  const borrowed = Math.min(needed - exact - other, Math.max(0, borrowedOfCard));
  const locked = Math.min(needed - exact - other - borrowed, Math.max(0, lockedOfCard));
  return {
    exact,
    other,
    borrowed,
    locked,
    missing: needed - exact - other - borrowed - locked,
  };
}

const BAND_FILL_ORDER = ["exact", "other", "borrowed", "locked", "missing"] as const;

export function copyBandSegments(
  band: OwnershipBandSegments,
  copyIndex: number,
): OwnershipBandSegments {
  const single: OwnershipBandSegments = { exact: 0, other: 0, borrowed: 0, locked: 0, missing: 0 };
  let filled = 0;
  for (const key of BAND_FILL_ORDER) {
    filled += band[key];
    if (copyIndex < filled) {
      single[key] = 1;
      return single;
    }
  }
  single.missing = 1;
  return single;
}

export interface OwnershipBandSources {
  availableByPrinting: Record<string, number>;
  availableByCardId: Record<string, number>;
  lockedByCardId: Record<string, number>;
  borrowedByCardId: Record<string, number>;
  /** Keyed by {@link getDeckCardKey}, resolved through the same helper as the thumbnail. */
  displayedPrintingIdByCardKey: Record<string, string>;
  ownedPrintingIdsByCardId: Record<string, readonly string[]>;
}

interface PrintingRef {
  printingId: string;
}

/**
 * Kept separate from {@link buildOwnershipBands} so the client-only catalog
 * bridge produces one stable object per data change.
 */
export function collectOwnershipBandSources(
  cards: readonly DeckBuilderCard[],
  printingsByCardId: ReadonlyMap<string, readonly PrintingRef[]>,
  resolvePrinting: (cardId: string, preferredPrintingId: string | null) => PrintingRef | undefined,
  availableByPrinting: Record<string, number>,
  lockedByPrinting: Record<string, number>,
  borrowedByPrinting: Record<string, number> = {},
): OwnershipBandSources {
  const availableByCardId: Record<string, number> = {};
  const lockedByCardId: Record<string, number> = {};
  const borrowedByCardId: Record<string, number> = {};
  const displayedPrintingIdByCardKey: Record<string, string> = {};
  const ownedPrintingIdsByCardId: Record<string, readonly string[]> = {};
  for (const card of cards) {
    if (availableByCardId[card.cardId] === undefined) {
      let total = 0;
      let locked = 0;
      let borrowed = 0;
      const printingIds = new Set(
        (printingsByCardId.get(card.cardId) ?? []).map((printing) => printing.printingId),
      );
      for (const printingId of printingIds) {
        total += availableByPrinting[printingId] ?? 0;
        locked += lockedByPrinting[printingId] ?? 0;
        borrowed += borrowedByPrinting[printingId] ?? 0;
      }
      availableByCardId[card.cardId] = total;
      ownedPrintingIdsByCardId[card.cardId] = [...printingIds].filter(
        (printingId) => (availableByPrinting[printingId] ?? 0) > 0,
      );
      lockedByCardId[card.cardId] = locked;
      borrowedByCardId[card.cardId] = borrowed;
    }
    const displayed = resolvePrinting(card.cardId, card.preferredPrintingId);
    if (displayed) {
      displayedPrintingIdByCardKey[getDeckCardKey(card)] = displayed.printingId;
    }
  }
  return {
    availableByPrinting,
    availableByCardId,
    lockedByCardId,
    borrowedByCardId,
    displayedPrintingIdByCardKey,
    ownedPrintingIdsByCardId,
  };
}

function sameIdLists(
  left: Record<string, readonly string[]>,
  right: Record<string, readonly string[]>,
): boolean {
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) {
    return false;
  }
  return keys.every((key) => left[key]?.join(",") === right[key]?.join(","));
}

function sameRecord<Value>(left: Record<string, Value>, right: Record<string, Value>): boolean {
  if (left === right) {
    return true;
  }
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) {
    return false;
  }
  for (const key of keys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

/**
 * An equal-but-new object must not count as a change: keeping the previous
 * one lets React skip the re-render, avoiding a fresh-object-per-render loop.
 */
export function sameOwnershipBandSources(
  left: OwnershipBandSources | undefined,
  right: OwnershipBandSources | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    sameRecord(left.availableByPrinting, right.availableByPrinting) &&
    sameRecord(left.availableByCardId, right.availableByCardId) &&
    sameRecord(left.lockedByCardId, right.lockedByCardId) &&
    sameRecord(left.borrowedByCardId, right.borrowedByCardId) &&
    sameRecord(left.displayedPrintingIdByCardKey, right.displayedPrintingIdByCardKey) &&
    sameIdLists(left.ownedPrintingIdsByCardId, right.ownedPrintingIdsByCardId)
  );
}

/**
 * Copies are allocated across entries, not per entry: every entry claims its
 * displayed printing first (one pool per printing), then remaining copies of
 * the card fill in as "another printing". Both passes share one per-card
 * pool, so no copy is claimed twice across entries or zones. Entries with
 * nothing owned are left out of the returned map.
 */
export function buildOwnershipBands(
  cards: readonly DeckBuilderCard[],
  sources: OwnershipBandSources,
  ownedPrintingByCardId:
    | ReadonlyMap<string, { id: string; imageId: string | undefined }>
    | undefined,
  preferOwned: boolean,
): Map<string, OwnershipBandSegments> {
  return buildOwnershipCopies(cards, sources, ownedPrintingByCardId, preferOwned).bands;
}

export interface OwnershipCopies {
  bands: Map<string, OwnershipBandSegments>;
  otherPrintingIdsByCardKey: Map<string, string[]>;
}

export function buildOwnershipCopies(
  cards: readonly DeckBuilderCard[],
  sources: OwnershipBandSources,
  ownedPrintingByCardId:
    | ReadonlyMap<string, { id: string; imageId: string | undefined }>
    | undefined,
  preferOwned: boolean,
): OwnershipCopies {
  const ordered = cards.toSorted(
    (left, right) => Number(isCountedZone(right.zone)) - Number(isCountedZone(left.zone)),
  );

  const claimedByPrinting = new Map<string, number>();
  const claimedByCard = new Map<string, number>();
  const exactByCardKey = new Map<string, number>();
  const displayedIdByCardKey = new Map<string, string>();

  // Every entry claims its own printing before any "other printing" is
  // handed out, so a later entry's printing isn't spent as a substitute.
  for (const card of ordered) {
    const owned = preferOwned ? ownedPrintingByCardId?.get(card.cardId) : undefined;
    const displayedId = owned?.imageId
      ? owned.id
      : sources.displayedPrintingIdByCardKey[getDeckCardKey(card)];
    const cardLeft =
      (sources.availableByCardId[card.cardId] ?? 0) - (claimedByCard.get(card.cardId) ?? 0);
    const printingLeft = displayedId
      ? (sources.availableByPrinting[displayedId] ?? 0) - (claimedByPrinting.get(displayedId) ?? 0)
      : 0;
    const exact = Math.max(0, Math.min(card.quantity, printingLeft, cardLeft));
    exactByCardKey.set(getDeckCardKey(card), exact);
    if (displayedId) {
      displayedIdByCardKey.set(getDeckCardKey(card), displayedId);
    }
    if (exact > 0 && displayedId) {
      claimedByPrinting.set(displayedId, (claimedByPrinting.get(displayedId) ?? 0) + exact);
      claimedByCard.set(card.cardId, (claimedByCard.get(card.cardId) ?? 0) + exact);
    }
  }

  const claimedBorrowedByCard = new Map<string, number>();
  const claimedLockedByCard = new Map<string, number>();
  const bands = new Map<string, OwnershipBandSegments>();
  const otherPrintingIdsByCardKey = new Map<string, string[]>();
  for (const card of ordered) {
    const key = getDeckCardKey(card);
    const cardLeft =
      (sources.availableByCardId[card.cardId] ?? 0) - (claimedByCard.get(card.cardId) ?? 0);
    const borrowedLeft =
      (sources.borrowedByCardId[card.cardId] ?? 0) - (claimedBorrowedByCard.get(card.cardId) ?? 0);
    const lockedLeft =
      (sources.lockedByCardId[card.cardId] ?? 0) - (claimedLockedByCard.get(card.cardId) ?? 0);
    const segments = ownershipBandSegments(
      card.quantity,
      exactByCardKey.get(key) ?? 0,
      cardLeft,
      borrowedLeft,
      lockedLeft,
    );
    if (segments.other > 0) {
      claimedByCard.set(card.cardId, (claimedByCard.get(card.cardId) ?? 0) + segments.other);
      const displayedId = displayedIdByCardKey.get(key);
      const otherIds: string[] = [];
      for (const printingId of sources.ownedPrintingIdsByCardId[card.cardId] ?? []) {
        if (printingId === displayedId) {
          continue;
        }
        const left =
          (sources.availableByPrinting[printingId] ?? 0) - (claimedByPrinting.get(printingId) ?? 0);
        const take = Math.min(left, segments.other - otherIds.length);
        for (let step = 0; step < take; step++) {
          otherIds.push(printingId);
        }
        if (take > 0) {
          claimedByPrinting.set(printingId, (claimedByPrinting.get(printingId) ?? 0) + take);
        }
      }
      otherPrintingIdsByCardKey.set(key, otherIds);
    }
    if (segments.borrowed > 0) {
      claimedBorrowedByCard.set(
        card.cardId,
        (claimedBorrowedByCard.get(card.cardId) ?? 0) + segments.borrowed,
      );
    }
    if (segments.locked > 0) {
      claimedLockedByCard.set(
        card.cardId,
        (claimedLockedByCard.get(card.cardId) ?? 0) + segments.locked,
      );
    }
    if (segments.exact > 0 || segments.other > 0 || segments.borrowed > 0 || segments.locked > 0) {
      bands.set(key, segments);
    }
  }
  return { bands, otherPrintingIdsByCardKey };
}

export function copyPrintingId(
  copies: OwnershipCopies,
  card: DeckBuilderCard,
  copyIndex: number,
): string | undefined {
  const key = getDeckCardKey(card);
  const band = copies.bands.get(key);
  if (!band || copyIndex < band.exact) {
    return undefined;
  }
  return copies.otherPrintingIdsByCardKey.get(key)?.[copyIndex - band.exact];
}

export function ownershipBandTitle(quantity: number, segments: OwnershipBandSegments): string {
  const { exact, other, borrowed, locked } = segments;
  const needed = Math.max(0, quantity);
  const lockedSuffix = locked === 0 ? "" : m.decks_overview_band_suffix_locked({ count: locked });
  const borrowedSuffix =
    borrowed === 0 ? "" : m.decks_overview_band_suffix_borrowed({ count: borrowed });
  // The `> 0` guard matters: an entry needing nothing has borrowed === needed
  // === 0 and must not read "you're borrowing all 0".
  if (borrowed > 0 && borrowed === needed) {
    return needed === 1
      ? m.decks_overview_band_borrowed_one()
      : m.decks_overview_band_borrowed_all({ count: needed });
  }
  if (exact === 0 && other === 0 && locked === 0 && borrowed > 0) {
    return m.decks_overview_band_borrowed_some({ borrowed, needed });
  }
  if (exact === needed) {
    return needed === 1
      ? m.decks_overview_band_exact_one()
      : m.decks_overview_band_exact_all({ count: needed });
  }
  if (other === needed) {
    return needed === 1
      ? m.decks_overview_band_other_one()
      : m.decks_overview_band_other_all({ count: needed });
  }
  if (exact > 0 && other > 0) {
    return m.decks_overview_band_exact_and_other({
      exact,
      needed,
      other,
      suffix: `${borrowedSuffix}${lockedSuffix}`,
    });
  }
  if (exact > 0) {
    return m.decks_overview_band_exact_some({
      exact,
      needed,
      suffix: `${borrowedSuffix}${lockedSuffix}`,
    });
  }
  if (other > 0) {
    return m.decks_overview_band_other_some({
      other,
      needed,
      suffix: `${borrowedSuffix}${lockedSuffix}`,
    });
  }
  if (locked === needed) {
    return needed === 1
      ? m.decks_overview_band_locked_one()
      : m.decks_overview_band_locked_all({ count: needed });
  }
  return m.decks_overview_band_locked_some({ locked, needed, suffix: borrowedSuffix });
}
