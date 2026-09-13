import { straightenApostrophes } from "@openrift/shared/utils";

export interface CardLine {
  name: string;
  quantity: number;
}

export interface DetailedCardLine extends CardLine {
  /** Short code, language and whatever sets the printing apart from the standard one. */
  details: readonly string[];
}

/** Merges duplicate names into their first occurrence, keeping the caller's order. */
function mergeCardLines(lines: readonly CardLine[]): CardLine[] {
  const merged = new Map<string, CardLine>();
  for (const line of lines) {
    const name = straightenApostrophes(line.name);
    const existing = merged.get(name);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      merged.set(name, { name, quantity: line.quantity });
    }
  }
  return [...merged.values()];
}

/** Apostrophes are straightened to ASCII to match the deck text codec other deckbuilder tools read. */
export function formatCardListAsDeckText(lines: readonly CardLine[]): string {
  return mergeCardLines(lines)
    .map((line) => `${line.quantity} ${line.name}`)
    .join("\n");
}

/** Cardmarket's "add multiple wants" import matches lines by card name; any extra text breaks the match. */
export function formatCardmarketWants(lines: readonly CardLine[]): string {
  return mergeCardLines(lines)
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((line) => `${line.quantity}x ${line.name}`)
    .join("\n");
}

/** Set and collector numbers are left out: CardTrader's paste import can't parse lettered numbers like `202a` or `R04`. */
export function formatCardtraderWishlist(lines: readonly CardLine[]): string {
  return lines
    .map((line) => ({ name: straightenApostrophes(line.name), quantity: line.quantity }))
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((line) => `${line.quantity} ${line.name}`)
    .join("\n");
}

export function formatCardListWithDetails(lines: readonly DetailedCardLine[]): string {
  return lines
    .map((line) =>
      [`${line.quantity} ${straightenApostrophes(line.name)}`, ...line.details].join(" · "),
    )
    .join("\n");
}
