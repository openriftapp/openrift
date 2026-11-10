import { copyLimitFor } from "@openrift/shared/deck-rules";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import {
  COPY_LIMIT_ZONES,
  copyLimitTotal,
  isBattlefieldZoneFull,
} from "@/features/decks/lib/deck-builder-card";
import type { RelaxedAddOutcome } from "@/features/decks/lib/workbench-add-toast";

export type WorkbenchAddRoute = "add" | "legend" | "replace";

export function workbenchAddRoute(
  card: { cardTypes: DeckBuilderCard["cardTypes"] },
  zone: DeckZone,
  deckCards: readonly { zone: DeckZone; quantity: number }[],
  format: DeckFormat,
): WorkbenchAddRoute {
  if (format === WellKnown.deckFormat.FREEFORM) {
    return "add";
  }
  if (zone === WellKnown.deckZone.LEGEND && card.cardTypes.includes(WellKnown.cardType.LEGEND)) {
    return "legend";
  }
  if (zone === WellKnown.deckZone.BATTLEFIELD) {
    return isBattlefieldZoneFull(deckCards, format) ? "replace" : "add";
  }
  return "add";
}

export function relaxedMoveOutcome(args: {
  card: DeckBuilderCard;
  fromZone: DeckZone;
  toZone: DeckZone;
  moved: number;
  allCards: readonly DeckBuilderCard[];
  format: DeckFormat;
}): RelaxedAddOutcome | undefined {
  const { card, fromZone, toZone, moved, allCards, format } = args;
  if (
    format === WellKnown.deckFormat.FREEFORM ||
    !COPY_LIMIT_ZONES.has(toZone) ||
    COPY_LIMIT_ZONES.has(fromZone)
  ) {
    return undefined;
  }
  const limit = copyLimitFor(card);
  const total = copyLimitTotal(allCards, card.cardId) + moved;
  if (total <= limit) {
    return undefined;
  }
  return { rule: "copyLimit", card, zone: toZone, quantity: moved, total, limit };
}
