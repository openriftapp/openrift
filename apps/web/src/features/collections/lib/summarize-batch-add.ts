import { m } from "@/paraglide/messages.js";

/** "Added N× Card Name" for a single-printing batch, "Added N cards" otherwise. */
export function summarizeBatchAdd(
  printingIds: string[],
  nameById: (printingId: string) => string | undefined,
): string | null {
  const [first] = printingIds;
  if (first === undefined) {
    return null;
  }
  const allSame = printingIds.every((id) => id === first);
  if (allSame) {
    const name = nameById(first) ?? m.collections_copies_added_card_fallback();
    return m.collections_copies_added_named({ count: printingIds.length, name });
  }
  return m.collections_copies_added_other({ count: printingIds.length });
}
