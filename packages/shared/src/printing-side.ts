import type { Printing } from "./types/catalog.js";

/** Unique per catalog entry: the printing id for side 1, suffixed for side 2. */
export function sideKey(printing: Pick<Printing, "printingId" | "side">): string {
  return printing.side === 1 ? printing.printingId : `${printing.printingId}:2`;
}

export function uniquePrintings<T extends Pick<Printing, "printingId">>(
  entries: readonly T[],
): T[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.printingId)) {
      return false;
    }
    seen.add(entry.printingId);
    return true;
  });
}

/** Indexes entries by printing id; a double-sided printing answers with side 1. */
export function indexByPrinting<T extends Pick<Printing, "printingId" | "side">>(
  entries: readonly T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const entry of entries) {
    if (entry.side === 1 || !index.has(entry.printingId)) {
      index.set(entry.printingId, entry);
    }
  }
  return index;
}

/** Owned copies per card, counting each printing once per card even when it shows the card twice. */
export function ownedTotalsByCard(
  entries: readonly Pick<Printing, "printingId" | "cardId">[],
  ownedByPrinting: Readonly<Record<string, number>>,
): Map<string, number> {
  const seen = new Set<string>();
  const totals = new Map<string, number>();
  for (const { printingId, cardId } of entries) {
    const key = `${cardId}:${printingId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    totals.set(cardId, (totals.get(cardId) ?? 0) + (ownedByPrinting[printingId] ?? 0));
  }
  return totals;
}

export function countPrintings(entries: readonly Pick<Printing, "printingId">[]): number {
  return new Set(entries.map((entry) => entry.printingId)).size;
}
