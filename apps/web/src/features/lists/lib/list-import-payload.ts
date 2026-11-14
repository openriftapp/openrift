import type { MatchedEntry } from "@/features/collections/lib/import-matcher";

export type ImportableListKind = "card" | "printing";

interface ListImportPayloadEntry {
  cardId?: string;
  printingId?: string;
  quantity: number;
}

export function buildListImportPayload(
  readyEntries: MatchedEntry[],
  listKind: ImportableListKind,
): ListImportPayloadEntry[] {
  return readyEntries.map((entry) =>
    listKind === "printing"
      ? { printingId: entry.resolvedPrinting?.printingId ?? "", quantity: entry.entry.quantity }
      : { cardId: entry.resolvedPrinting?.cardId ?? "", quantity: entry.entry.quantity },
  );
}
