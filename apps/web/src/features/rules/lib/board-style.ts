import type { BoardPlayer } from "@openrift/shared/board-state";

import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";

export const PLAYER_COLOR: Record<BoardPlayer, string> = {
  A: "oklch(0.55 0.08 195)",
  B: "oklch(0.6 0.1 75)",
  C: "oklch(0.55 0.1 330)",
  D: "oklch(0.55 0.1 140)",
};

/** Card frame, upright and on its side; the outer box keeps the rotated footprint. */
export const CARD_UPRIGHT = "h-[calc(var(--board-card-w)*1.4)] w-[var(--board-card-w)]";
export const CARD_TURNED = "h-[var(--board-card-w)] w-[calc(var(--board-card-w)*1.4)]";
export const CARD_ROW_HEIGHT = "h-[calc(var(--board-card-w)*1.4+1.4rem)]";
/** The card browser's corner radius, so every mini card rounds in scale with its size. */
export const CARD_CORNER_STYLE = { borderRadius: CARD_BORDER_RADIUS } as const;
/** The same radius on a card lying sideways (battlefields). */
export const LANDSCAPE_CORNER_STYLE = { borderRadius: "3.6% / 5%" } as const;

/** Zone edges read as chalk on felt, tinted towards the seat's colour. */
export function zoneEdge(owner: BoardPlayer): string {
  return `color-mix(in oklab, ${PLAYER_COLOR[owner]} 45%, oklch(1 0 0 / 0.5))`;
}

export function seatInk(owner: BoardPlayer): string {
  return `color-mix(in oklab, ${PLAYER_COLOR[owner]} 55%, white)`;
}
