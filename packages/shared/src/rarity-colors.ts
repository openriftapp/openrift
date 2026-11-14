import type { WellKnown } from "./well-known.js";

export const DEFAULT_RARITY_COLORS: Record<string, string> = {
  common: "#A6A6A6",
  uncommon: "#47D1D1",
  rare: "#E052B1",
  epic: "#FA8938",
  showcase: "#FFCC00",
} satisfies Record<(typeof WellKnown.rarity)[keyof typeof WellKnown.rarity], string>;
