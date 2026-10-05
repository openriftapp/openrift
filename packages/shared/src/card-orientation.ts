import type { CardType } from "./types/enums.js";
import { WellKnown } from "./well-known.js";

export function getOrientation(types: readonly CardType[]): "portrait" | "landscape" {
  return types.includes(WellKnown.cardType.BATTLEFIELD) ? "landscape" : "portrait";
}
