import { WellKnown } from "@openrift/shared/well-known";

import { m } from "@/paraglide/messages.js";

export type DeckFormatBadgeKind = "draft" | "invalid" | "building" | "settled";

export interface DeckFormatBadgeState {
  kind: DeckFormatBadgeKind;
  progress?: string;
}

/** `building` also covers formats (Freeform, Custom-Region) the deck-list endpoint always reports valid. */
export function deckFormatBadgeState({
  format,
  totalCards,
  requiredProgress,
  requiredTotal,
  isValid,
}: {
  format: string;
  totalCards: number;
  requiredProgress: number;
  requiredTotal: number;
  isValid: boolean;
}): DeckFormatBadgeState {
  const isFreeform = format === WellKnown.deckFormat.FREEFORM;
  const progress =
    requiredTotal > 0 && requiredProgress < requiredTotal
      ? m.decks_editor_required_progress({ progress: requiredProgress, total: requiredTotal })
      : undefined;

  if (totalCards === 0) {
    return isFreeform ? { kind: "settled" } : { kind: "draft" };
  }
  if (!isValid && !isFreeform) {
    return { kind: "invalid", progress };
  }
  if (progress) {
    return { kind: "building", progress };
  }
  return { kind: "settled" };
}
