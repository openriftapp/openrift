import { cardTextPlain, truncateAtWord } from "./card-text.js";

export function rulesTeaser(text: string, max: number): string {
  return truncateAtWord(cardTextPlain(text), max);
}
