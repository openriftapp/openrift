import { clampPageLimit } from "../../../lib/xid-watermark.js";

const DECK_CARDS_PAGE_MAX = 10_000;

export function clampDeckCardsLimit(limit?: number): number {
  return clampPageLimit(limit, DECK_CARDS_PAGE_MAX);
}
