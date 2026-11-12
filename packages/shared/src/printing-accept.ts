import type { Rarity } from "./types/enums.js";
import { LOW_RARITIES, WellKnown } from "./well-known.js";

export const REQUIRED_ACCEPT_PRINTING_FIELDS = [
  "shortCode",
  "setId",
  "rarity",
  "finish",
  "artist",
  "publicCode",
] as const;

export type RequiredAcceptPrintingField = (typeof REQUIRED_ACCEPT_PRINTING_FIELDS)[number];

export function resolveFinish(
  finish: string | null | undefined,
  rarity: string | null | undefined,
): string | null {
  if (finish) {
    return finish;
  }
  if (!rarity) {
    return null;
  }
  return LOW_RARITIES.has(rarity.toLowerCase() as Rarity)
    ? WellKnown.finish.NORMAL
    : WellKnown.finish.FOIL;
}
