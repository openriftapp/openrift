import type { CardType } from "./types/enums.js";
import { WellKnown } from "./well-known.js";

/** 63mm x 88mm */
export const CARD_ASPECT = 63 / 88;

export const LANDSCAPE_CARD_ASPECT = 88 / 63;

export function getOrientation(types: readonly CardType[]): "portrait" | "landscape" {
  return types.includes(WellKnown.cardType.BATTLEFIELD) ? "landscape" : "portrait";
}
