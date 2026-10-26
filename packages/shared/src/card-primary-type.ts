import type { CardType } from "./types/enums.js";

export function primaryCardType(types: readonly CardType[]): CardType {
  const [first] = types;
  if (first === undefined) {
    throw new Error("A card must have at least one type");
  }
  return first;
}
