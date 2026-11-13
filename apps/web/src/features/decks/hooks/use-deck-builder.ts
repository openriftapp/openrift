import { legendDisplayName } from "@openrift/shared/card-name";
import type { DeckViolation } from "@openrift/shared/deck-rules";
import {
  battlefieldCapFor,
  copyLimitFor,
  requiredLegendOptions,
  RUNE_TARGET,
  totalQuantity,
  validateDeck,
} from "@openrift/shared/deck-rules";
import { isSingleSlotZone } from "@openrift/shared/deck-zones";
import { enumLabel } from "@openrift/shared/enum-label";
import type { DeckFormatConfig } from "@openrift/shared/types/api/deck";
import type { DeckFormat, DeckZone, Domain } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { useLiveQuery } from "@tanstack/react-db";
import type { Collection } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";

import { useCustomTagAssignments } from "@/features/collections/hooks/use-custom-tag-assignments";
import { useDeckDraftCollection, useDeckDraftScope } from "@/features/decks/hooks/use-deck-draft";
import { useDeckDetail } from "@/features/decks/hooks/use-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import {
  canAddRune,
  COPY_LIMIT_ZONES,
  copyLimitTotal,
  deckCardKey,
  isBattlefieldZoneFull,
  isCardAllowedInZone,
  runeTotalOf,
  toRuleEngineCard,
} from "@/features/decks/lib/deck-builder-card";
import { legendSwitchCards } from "@/features/decks/lib/legend-switch-preview";
import type { RelaxedAddOutcome } from "@/features/decks/lib/workbench-add-toast";
import {
  dismissRemovalToast,
  showRelaxedAddToast,
  showRemovalToast,
} from "@/features/decks/lib/workbench-add-toast";
import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import { applyDeckSnapshot } from "@/features/decks/stores/deck-draft-store";
import {
  copySnapshot,
  sameDeckCards,
  useDeckUndoStore,
} from "@/features/decks/stores/deck-undo-store";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { useChampionIdentifierTags, useZoneOrder } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

const EMPTY_CARDS: DeckBuilderCard[] = [];

type DeckCollection = Collection<DeckBuilderCard, string | number>;

export function allCards(collection: DeckCollection): DeckBuilderCard[] {
  return [...collection.values()];
}

/**
 * Prefers the default-art row (preferredPrintingId === null) so pinned
 * printings stay sticky when users decrement via the card browser.
 */
function findRowForCardInZone(
  cards: DeckBuilderCard[],
  cardId: string,
  zone: DeckZone,
): DeckBuilderCard | undefined {
  const matches = cards.filter((c) => c.cardId === cardId && c.zone === zone);
  if (matches.length === 0) {
    return undefined;
  }
  return matches.find((c) => c.preferredPrintingId === null) ?? matches[0];
}

/**
 * After a rune is added or removed, adjusts a rune of the opposite domain so
 * the total stays at RUNE_TARGET, falling back to the catalog's runesByDomain.
 */
function rebalanceRunes(
  collection: DeckCollection,
  changedDomains: Domain[],
  runesByDomain: Map<string, DeckBuilderCard[]>,
): DeckBuilderCard | undefined {
  const cards = allCards(collection);
  const runeTotal = runeTotalOf(cards);
  if (runeTotal === RUNE_TARGET) {
    return undefined;
  }

  const legend = cards.find((card) => card.zone === WellKnown.deckZone.LEGEND);
  if (!legend || legend.domains.length < 2) {
    return undefined;
  }

  const otherDomain = legend.domains.find((domain) => !changedDomains.includes(domain));
  if (!otherDomain) {
    return undefined;
  }

  if (runeTotal > RUNE_TARGET) {
    const otherRune = cards.find(
      (card) =>
        card.zone === WellKnown.deckZone.RUNES &&
        card.domains.some((domain) => domain === otherDomain),
    );
    if (!otherRune) {
      return undefined;
    }
    const key = deckCardKey({
      cardId: otherRune.cardId,
      zone: WellKnown.deckZone.RUNES,
      preferredPrintingId: otherRune.preferredPrintingId,
    });
    if (otherRune.quantity > 1) {
      collection.update(key, (draft) => {
        draft.quantity -= 1;
      });
    } else {
      collection.delete(key);
    }
    return otherRune;
  }

  const existingOther = cards.find(
    (card) =>
      card.zone === WellKnown.deckZone.RUNES &&
      card.domains.some((domain) => domain === otherDomain),
  );
  if (existingOther) {
    collection.update(
      deckCardKey({
        cardId: existingOther.cardId,
        zone: WellKnown.deckZone.RUNES,
        preferredPrintingId: existingOther.preferredPrintingId,
      }),
      (draft) => {
        draft.quantity += 1;
      },
    );
    return undefined;
  }
  const [catalogRune] = runesByDomain.get(otherDomain) ?? [];
  if (catalogRune) {
    collection.insert({
      ...catalogRune,
      zone: WellKnown.deckZone.RUNES,
      quantity: 1,
      preferredPrintingId: null,
    });
  }
  return undefined;
}

function incrementOrInsert(
  collection: DeckCollection,
  card: DeckBuilderCard,
  zone: DeckZone,
  preferredPrintingId: string | null,
  addQty: number,
): void {
  const key = deckCardKey({
    cardId: card.cardId,
    zone,
    preferredPrintingId,
  });
  const existing = collection.get(key);
  if (existing) {
    collection.update(key, (draft) => {
      draft.quantity += addQty;
    });
  } else {
    collection.insert({ ...card, zone, quantity: addQty, preferredPrintingId });
  }
}

export function addCardAction(
  collection: DeckCollection,
  card: DeckBuilderCard,
  zone: DeckZone,
  count: number | undefined,
  runesByDomain: Map<string, DeckBuilderCard[]>,
  format: DeckFormat,
  options?: { relaxed?: boolean },
): RelaxedAddOutcome | undefined {
  const relaxed = options?.relaxed === true;
  if (!isCardAllowedInZone(card, zone)) {
    return undefined;
  }
  const preferredPrintingId = card.preferredPrintingId;
  const freeform = format === WellKnown.deckFormat.FREEFORM;

  if (isSingleSlotZone(zone)) {
    if (freeform) {
      incrementOrInsert(collection, card, zone, preferredPrintingId, count ?? 1);
      return undefined;
    }
    // Constructed: single-card zones replace whatever is there, across any printing.
    for (const existing of allCards(collection)) {
      if (existing.zone === zone) {
        collection.delete(
          deckCardKey({
            cardId: existing.cardId,
            zone,
            preferredPrintingId: existing.preferredPrintingId,
          }),
        );
      }
    }
    collection.insert({ ...card, zone, quantity: 1, preferredPrintingId });
    return undefined;
  }

  if (zone === WellKnown.deckZone.BATTLEFIELD) {
    if (freeform) {
      incrementOrInsert(collection, card, zone, preferredPrintingId, count ?? 1);
      return undefined;
    }
    const cards = allCards(collection);
    const zoneCards = cards.filter((entry) => entry.zone === WellKnown.deckZone.BATTLEFIELD);
    const duplicate = zoneCards.some((entry) => entry.cardId === card.cardId);
    const full = isBattlefieldZoneFull(cards, format);
    if ((duplicate || full) && !relaxed) {
      return undefined;
    }
    incrementOrInsert(collection, card, zone, preferredPrintingId, 1);
    if (duplicate || full) {
      return {
        rule: duplicate ? "battlefieldDuplicate" : "battlefieldCap",
        card,
        zone,
        quantity: 1,
        total: totalQuantity(zoneCards) + (duplicate ? 0 : 1),
        limit: battlefieldCapFor(format),
      };
    }
    return undefined;
  }

  if (zone === WellKnown.deckZone.LEGEND_OPTIONS) {
    if (freeform) {
      incrementOrInsert(collection, card, zone, preferredPrintingId, count ?? 1);
      return undefined;
    }
    const cards = allCards(collection);
    const legendOptionCards = cards.filter(
      (entry) => entry.zone === WellKnown.deckZone.LEGEND_OPTIONS,
    );
    const held = legendOptionCards.reduce((sum, entry) => sum + entry.quantity, 0);
    const required = requiredLegendOptions(cards);
    const blocked =
      legendOptionCards.some((entry) => entry.cardId === card.cardId) || held >= required;
    if (blocked && !relaxed) {
      return undefined;
    }
    incrementOrInsert(collection, card, zone, preferredPrintingId, 1);
    return blocked
      ? { rule: "legendOptionsCap", card, zone, quantity: 1, total: held + 1, limit: required }
      : undefined;
  }

  if (zone === WellKnown.deckZone.RUNES) {
    if (freeform) {
      incrementOrInsert(collection, card, zone, preferredPrintingId, count ?? 1);
      return undefined;
    }
    const addQty = count ?? 1;
    let outcome: RelaxedAddOutcome | undefined;
    for (let step = 0; step < addQty; step++) {
      const cards = allCards(collection);
      if (!canAddRune(card, cards)) {
        if (relaxed) {
          incrementOrInsert(collection, card, WellKnown.deckZone.RUNES, preferredPrintingId, 1);
          outcome = {
            rule: "runeCap",
            card,
            zone,
            quantity: 1,
            total: runeTotalOf(cards) + 1,
            limit: RUNE_TARGET,
          };
        }
        break;
      }
      const existing = cards.find(
        (entry) =>
          entry.cardId === card.cardId &&
          entry.zone === WellKnown.deckZone.RUNES &&
          entry.preferredPrintingId === preferredPrintingId,
      );
      if (existing) {
        collection.update(
          deckCardKey({
            cardId: card.cardId,
            zone: WellKnown.deckZone.RUNES,
            preferredPrintingId,
          }),
          (draft) => {
            draft.quantity += 1;
          },
        );
      } else {
        collection.insert({
          ...card,
          zone: WellKnown.deckZone.RUNES,
          quantity: 1,
          preferredPrintingId,
        });
      }
      const swappedOut = rebalanceRunes(collection, card.domains, runesByDomain);
      if (relaxed && swappedOut && addQty === 1) {
        outcome = {
          rule: "runeSwap",
          card,
          zone,
          quantity: 1,
          total: RUNE_TARGET,
          limit: RUNE_TARGET,
          swappedOut,
        };
      }
    }
    return outcome;
  }

  // Overflow is a free parking zone, not in COPY_LIMIT_ZONES, so it skips the cap.
  let addQty = count ?? 1;
  if (!freeform && COPY_LIMIT_ZONES.has(zone)) {
    const limit = copyLimitFor(card);
    const total = copyLimitTotal(allCards(collection), card.cardId);
    if (relaxed && total >= limit) {
      incrementOrInsert(collection, card, zone, preferredPrintingId, 1);
      return { rule: "copyLimit", card, zone, quantity: 1, total: total + 1, limit };
    }
    if (total >= limit) {
      return undefined;
    }
    addQty = Math.min(addQty, limit - total);
  }
  incrementOrInsert(collection, card, zone, preferredPrintingId, addQty);
  return undefined;
}

/**
 * When preferredPrintingId is undefined, operates on the default-art row
 * first, so the card browser's minus button leaves pinned printings alone.
 */
export function removeCardAction(
  collection: DeckCollection,
  cardId: string,
  zone: DeckZone,
  runesByDomain: Map<string, DeckBuilderCard[]>,
  format: DeckFormat,
  preferredPrintingId?: string | null,
): void {
  const target =
    preferredPrintingId === undefined
      ? findRowForCardInZone(allCards(collection), cardId, zone)
      : collection.get(deckCardKey({ cardId, zone, preferredPrintingId }));
  if (!target) {
    return;
  }
  const key = deckCardKey({
    cardId: target.cardId,
    zone: target.zone,
    preferredPrintingId: target.preferredPrintingId,
  });
  if (target.quantity > 1) {
    collection.update(key, (draft) => {
      draft.quantity -= 1;
    });
  } else {
    collection.delete(key);
  }
  if (zone === WellKnown.deckZone.RUNES && format !== WellKnown.deckFormat.FREEFORM) {
    rebalanceRunes(collection, target.domains, runesByDomain);
  }
}

function zoneTotal(collection: DeckCollection, zone: DeckZone): number {
  return totalQuantity(allCards(collection).filter((card) => card.zone === zone));
}

function displayName(card: DeckBuilderCard): string {
  return legendDisplayName({ name: card.cardName, types: card.cardTypes, tags: card.tags });
}

export function undoRelaxedAddAction(
  collection: DeckCollection,
  outcome: RelaxedAddOutcome,
  runesByDomain: Map<string, DeckBuilderCard[]>,
  format: DeckFormat,
): void {
  const { card, zone, swappedOut } = outcome;
  if (outcome.rule === "runeSwap" && swappedOut) {
    const row = collection.get(
      deckCardKey({
        cardId: card.cardId,
        zone,
        preferredPrintingId: card.preferredPrintingId,
      }),
    );
    if (row) {
      setQuantityAction(collection, row.cardId, zone, row.quantity - 1, row.preferredPrintingId);
    }
    incrementOrInsert(collection, swappedOut, zone, swappedOut.preferredPrintingId, 1);
    return;
  }
  removeCardAction(collection, card.cardId, zone, runesByDomain, format, card.preferredPrintingId);
}

export function replaceCardAction(
  collection: DeckCollection,
  outgoing: DeckBuilderCard,
  incoming: DeckBuilderCard,
  zone: DeckZone,
  runesByDomain: Map<string, DeckBuilderCard[]>,
  format: DeckFormat,
): void {
  removeCardAction(
    collection,
    outgoing.cardId,
    zone,
    runesByDomain,
    format,
    outgoing.preferredPrintingId,
  );
  addCardAction(collection, incoming, zone, undefined, runesByDomain, format, { relaxed: true });
}

// If the slot already holds the exact same card+printing, no-op to avoid silently dropping a copy.
function moveIntoSingleSlot(
  collection: DeckCollection,
  source: DeckBuilderCard,
  sourceKey: string,
  toZone: DeckZone,
): void {
  const existingInZone = allCards(collection).filter((card) => card.zone === toZone);
  const [onlyExisting] = existingInZone;
  if (
    existingInZone.length === 1 &&
    onlyExisting !== undefined &&
    onlyExisting.cardId === source.cardId &&
    onlyExisting.preferredPrintingId === source.preferredPrintingId
  ) {
    return;
  }
  for (const existing of existingInZone) {
    collection.delete(
      deckCardKey({
        cardId: existing.cardId,
        zone: toZone,
        preferredPrintingId: existing.preferredPrintingId,
      }),
    );
  }
  if (source.quantity > 1) {
    collection.update(sourceKey, (draft) => {
      draft.quantity -= 1;
    });
  } else {
    collection.delete(sourceKey);
  }
  collection.insert({ ...source, zone: toZone, quantity: 1 });
}

export function moveCardAction(
  collection: DeckCollection,
  cardId: string,
  fromZone: DeckZone,
  toZone: DeckZone,
  preferredPrintingId: string | null,
  format: DeckFormat,
): void {
  const sourceKey = deckCardKey({
    cardId,
    zone: fromZone,
    preferredPrintingId,
  });
  const source = collection.get(sourceKey);
  if (!source || !isCardAllowedInZone(source, toZone)) {
    return;
  }
  const singleSlot = isSingleSlotZone(toZone) && format !== WellKnown.deckFormat.FREEFORM;
  if (singleSlot) {
    moveIntoSingleSlot(collection, source, sourceKey, toZone);
    return;
  }
  const targetKey = deckCardKey({
    cardId,
    zone: toZone,
    preferredPrintingId,
  });
  const target = collection.get(targetKey);

  collection.delete(sourceKey);
  if (target) {
    collection.update(targetKey, (draft) => {
      draft.quantity += source.quantity;
    });
  } else {
    collection.insert({ ...source, zone: toZone });
  }
}

export function moveOneCardAction(
  collection: DeckCollection,
  cardId: string,
  fromZone: DeckZone,
  toZone: DeckZone,
  preferredPrintingId: string | null,
  format: DeckFormat,
): void {
  const sourceKey = deckCardKey({
    cardId,
    zone: fromZone,
    preferredPrintingId,
  });
  const source = collection.get(sourceKey);
  if (!source || !isCardAllowedInZone(source, toZone)) {
    return;
  }
  const singleSlot = isSingleSlotZone(toZone) && format !== WellKnown.deckFormat.FREEFORM;
  if (singleSlot) {
    moveIntoSingleSlot(collection, source, sourceKey, toZone);
    return;
  }
  if (source.quantity > 1) {
    collection.update(sourceKey, (draft) => {
      draft.quantity -= 1;
    });
  } else {
    collection.delete(sourceKey);
  }

  const targetKey = deckCardKey({
    cardId,
    zone: toZone,
    preferredPrintingId,
  });
  const target = collection.get(targetKey);
  if (target) {
    collection.update(targetKey, (draft) => {
      draft.quantity += 1;
    });
  } else {
    collection.insert({ ...source, zone: toZone, quantity: 1 });
  }
}

/**
 * Sets the row's quantity to an absolute value, or deletes it if <=0. When
 * preferredPrintingId is undefined, operates on the default-art row first.
 */
export function setQuantityAction(
  collection: DeckCollection,
  cardId: string,
  zone: DeckZone,
  quantity: number,
  preferredPrintingId?: string | null,
): void {
  const target =
    preferredPrintingId === undefined
      ? findRowForCardInZone(allCards(collection), cardId, zone)
      : collection.get(deckCardKey({ cardId, zone, preferredPrintingId }));
  if (!target) {
    return;
  }
  const key = deckCardKey({
    cardId: target.cardId,
    zone: target.zone,
    preferredPrintingId: target.preferredPrintingId,
  });
  if (quantity <= 0) {
    collection.delete(key);
    return;
  }
  collection.update(key, (draft) => {
    draft.quantity = quantity;
  });
}

/** When countToConvert equals the source row's full quantity, the source row is removed. */
export function changePreferredPrintingAction(
  collection: DeckCollection,
  cardId: string,
  zone: DeckZone,
  fromPrintingId: string | null,
  toPrintingId: string | null,
  countToConvert: number,
): void {
  if (fromPrintingId === toPrintingId) {
    return;
  }
  const sourceKey = deckCardKey({
    cardId,
    zone,
    preferredPrintingId: fromPrintingId,
  });
  const source = collection.get(sourceKey);
  if (!source) {
    return;
  }
  const take = Math.max(1, Math.min(countToConvert, source.quantity));

  if (take >= source.quantity) {
    collection.delete(sourceKey);
  } else {
    collection.update(sourceKey, (draft) => {
      draft.quantity -= take;
    });
  }

  const targetKey = deckCardKey({ cardId, zone, preferredPrintingId: toPrintingId });
  const target = collection.get(targetKey);
  if (target) {
    collection.update(targetKey, (draft) => {
      draft.quantity += take;
    });
  } else {
    collection.insert({ ...source, quantity: take, preferredPrintingId: toPrintingId });
  }
}

function replaceDeckCards(
  collection: DeckCollection,
  before: readonly DeckBuilderCard[],
  after: readonly DeckBuilderCard[],
): void {
  const afterByKey = new Map(after.map((card) => [deckCardKey(card), card]));
  const beforeByKey = new Map(before.map((card) => [deckCardKey(card), card]));
  for (const key of beforeByKey.keys()) {
    if (!afterByKey.has(key)) {
      collection.delete(key);
    }
  }
  for (const [key, card] of afterByKey) {
    const existing = beforeByKey.get(key);
    if (existing === undefined) {
      collection.insert(card);
    } else if (existing.quantity !== card.quantity) {
      collection.update(key, (draft) => {
        draft.quantity = card.quantity;
      });
    }
  }
}

export function setLegendAction(
  collection: DeckCollection,
  card: DeckBuilderCard,
  runesByDomain: Map<string, DeckBuilderCard[]>,
  format: DeckFormat,
  options?: { refill?: boolean; moveOffColorToOverflow?: boolean },
): void {
  const before = allCards(collection);
  replaceDeckCards(
    collection,
    before,
    legendSwitchCards(before, card, runesByDomain, format, { refill: options?.refill === true }),
  );
  if (format === WellKnown.deckFormat.FREEFORM || !options?.moveOffColorToOverflow) {
    return;
  }
  const allowed = new Set([...card.domains, WellKnown.domain.NEUTRAL, WellKnown.domain.COLORLESS]);
  for (const entry of allCards(collection)) {
    const offColor = entry.domains.some((domain) => !allowed.has(domain));
    if (
      offColor &&
      (entry.zone === WellKnown.deckZone.MAIN || entry.zone === WellKnown.deckZone.SIDEBOARD)
    ) {
      moveCardAction(
        collection,
        entry.cardId,
        entry.zone,
        WellKnown.deckZone.OVERFLOW,
        entry.preferredPrintingId,
        format,
      );
    }
  }
}

/**
 * Every card mutation in the app routes through here. Undo restores the deck
 * the user left, and an edit that changed nothing leaves no step behind.
 */
export function recordDeckEdit<T>(
  collection: DeckCollection,
  deckId: string,
  apply: () => T,
  options?: { separate?: boolean },
): T {
  dismissRemovalToast();
  const before = copySnapshot(allCards(collection));
  const result = apply();
  if (!sameDeckCards(before, allCards(collection))) {
    useDeckUndoStore.getState().record(deckId, before, options);
  }
  return result;
}

interface DeckBuilderActions {
  addCard: (card: DeckBuilderCard, zone?: DeckZone, count?: number) => void;
  removeCard: (cardId: string, zone: DeckZone, preferredPrintingId?: string | null) => void;
  replaceCard: (outgoing: DeckBuilderCard, incoming: DeckBuilderCard, zone: DeckZone) => void;
  moveCard: (
    cardId: string,
    fromZone: DeckZone,
    toZone: DeckZone,
    preferredPrintingId: string | null,
  ) => void;
  moveOneCard: (
    cardId: string,
    fromZone: DeckZone,
    toZone: DeckZone,
    preferredPrintingId: string | null,
  ) => void;
  setQuantity: (
    cardId: string,
    zone: DeckZone,
    quantity: number,
    preferredPrintingId?: string | null,
  ) => void;
  changePreferredPrinting: (
    cardId: string,
    zone: DeckZone,
    fromPrintingId: string | null,
    toPrintingId: string | null,
    countToConvert: number,
  ) => void;
  setLegend: (
    card: DeckBuilderCard,
    runesByDomain?: Map<string, DeckBuilderCard[]>,
    options?: { confirmed?: boolean; moveOffColorToOverflow?: boolean },
  ) => void;
}

export function useDeckBuilderActions(deckId: string): DeckBuilderActions {
  const { zoneLabels } = useZoneOrder();
  const collection = useDeckDraftCollection(deckId);
  const runesByDomain = useDeckBuilderUiStore((state) => state.runesByDomain);
  const activeZone = useDeckBuilderUiStore((state) => state.activeZone);
  const relaxed = useWorkbenchStore((state) => state.relaxed);
  const { data: deckDetail } = useDeckDetail(deckId);
  const format = deckDetail.deck.format;
  const queryClient = useQueryClient();
  const scope = useDeckDraftScope(deckId);

  // Mid-sign-out the collection briefly goes null while React commits the
  // unmount of this route; make all actions no-ops in that window.
  if (!collection) {
    // oxlint-disable-next-line typescript/no-empty-function -- intentional no-op stand-ins while the collection is null
    const noop = (): void => {};
    const noopActions: DeckBuilderActions = {
      addCard: noop,
      removeCard: noop,
      replaceCard: noop,
      moveCard: noop,
      moveOneCard: noop,
      setQuantity: noop,
      changePreferredPrinting: noop,
      setLegend: noop,
    };
    return noopActions;
  }

  const edit = <T>(apply: () => T, options?: { separate?: boolean }): T =>
    recordDeckEdit(collection, deckId, apply, options);

  // A removal the toast offers to undo is its own undo step, so its Undo
  // reverts this removal and nothing recorded just before it.
  const removeWithUndoToast = (
    cardId: string,
    zone: DeckZone,
    preferredPrintingId: string | null | undefined,
    allCopies: boolean,
    apply: () => void,
  ) => {
    const removed =
      preferredPrintingId === undefined
        ? findRowForCardInZone(allCards(collection), cardId, zone)
        : collection.get(deckCardKey({ cardId, zone, preferredPrintingId }));
    const offerUndo = relaxed && removed !== undefined && (allCopies || removed.quantity <= 1);
    edit(apply, { separate: offerUndo });
    if (!offerUndo || removed === undefined) {
      return;
    }
    showRemovalToast(
      m.decks_workbench_removed({ card: displayName(removed), zone: enumLabel(zoneLabels, zone) }),
      () => {
        const snapshot = useDeckUndoStore.getState().undo(deckId, allCards(collection));
        if (snapshot && scope) {
          applyDeckSnapshot(queryClient, scope, deckId, snapshot);
        }
      },
    );
  };

  return {
    addCard: (card, zone, count) => {
      const target = zone ?? activeZone;
      if (!target) {
        return;
      }
      const before = zoneTotal(collection, target);
      const outcome = edit(() =>
        addCardAction(collection, card, target, count, runesByDomain, format, { relaxed }),
      );
      if (relaxed && zoneTotal(collection, target) > before) {
        useWorkbenchStore.getState().announceAdd(displayName(card), target);
      }
      if (!outcome) {
        return;
      }
      showRelaxedAddToast(outcome, {
        undo: () => {
          edit(() => undoRelaxedAddAction(collection, outcome, runesByDomain, format));
        },
        keepBoth: outcome.swappedOut
          ? () => {
              const rune = outcome.swappedOut;
              if (rune) {
                edit(() =>
                  incrementOrInsert(
                    collection,
                    rune,
                    WellKnown.deckZone.RUNES,
                    rune.preferredPrintingId,
                    1,
                  ),
                );
              }
            }
          : undefined,
      });
    },
    replaceCard: (outgoing, incoming, zone) => {
      edit(() => replaceCardAction(collection, outgoing, incoming, zone, runesByDomain, format));
    },
    removeCard: (cardId, zone, preferredPrintingId) => {
      removeWithUndoToast(cardId, zone, preferredPrintingId, false, () =>
        removeCardAction(collection, cardId, zone, runesByDomain, format, preferredPrintingId),
      );
    },
    moveCard: (cardId, from, to, preferredPrintingId) => {
      edit(() => moveCardAction(collection, cardId, from, to, preferredPrintingId, format));
    },
    moveOneCard: (cardId, from, to, preferredPrintingId) => {
      edit(() => moveOneCardAction(collection, cardId, from, to, preferredPrintingId, format));
    },
    setQuantity: (cardId, zone, quantity, preferredPrintingId) => {
      const apply = () =>
        setQuantityAction(collection, cardId, zone, quantity, preferredPrintingId);
      if (quantity <= 0) {
        removeWithUndoToast(cardId, zone, preferredPrintingId, true, apply);
      } else {
        edit(apply);
      }
    },
    changePreferredPrinting: (cardId, zone, fromPrintingId, toPrintingId, countToConvert) => {
      edit(() =>
        changePreferredPrintingAction(
          collection,
          cardId,
          zone,
          fromPrintingId,
          toPrintingId,
          countToConvert,
        ),
      );
    },
    setLegend: (card, rbd, options) => {
      const current = allCards(collection).find(
        (entry) => entry.zone === WellKnown.deckZone.LEGEND,
      );
      const needsPreview =
        relaxed &&
        !options?.confirmed &&
        format !== WellKnown.deckFormat.FREEFORM &&
        current !== undefined &&
        current.cardId !== card.cardId;
      if (needsPreview) {
        useWorkbenchStore.getState().setPendingLegend(card);
        return;
      }
      edit(() =>
        setLegendAction(collection, card, rbd ?? runesByDomain, format, {
          refill: relaxed,
          moveOffColorToOverflow: options?.moveOffColorToOverflow,
        }),
      );
      if (relaxed) {
        useWorkbenchStore.getState().announceAdd(displayName(card), WellKnown.deckZone.LEGEND);
      }
    },
  };
}

export function useDeckCards(deckId: string): DeckBuilderCard[] {
  const collection = useDeckDraftCollection(deckId);
  const { data } = useLiveQuery({
    query: (q) => (collection ? q.from({ card: collection }) : null),
  });
  return data ?? EMPTY_CARDS;
}

export function useDeckViolations(
  deckId: string,
  format: DeckFormat,
  formatConfig: DeckFormatConfig | null,
): DeckViolation[] {
  const cards = useDeckCards(deckId);
  const customTagAssignments = useCustomTagAssignments();
  const championIdentifierTags = useChampionIdentifierTags();
  return validateDeck({
    format,
    formatConfig,
    cards: cards.map((card) => toRuleEngineCard(card, customTagAssignments)),
    championIdentifierTags,
  });
}
