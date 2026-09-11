import { straightenApostrophes } from "@openrift/shared/utils";

export interface CardLine {
  name: string;
  quantity: number;
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
