import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";

/**
 * The card/printing/copy a user picked to drop from a list's dynamic rules.
 * Exactly the id matching `kind` is set; the others are absent.
 */
export interface RuleDropTarget {
  kind: ListKind;
  cardId?: string;
  printingId?: string;
  copyId?: string;
}

export function entryToDropTarget(entry: ListEntryDetailResponse): RuleDropTarget {
  if (entry.kind === "card") {
    return { kind: "card", cardId: entry.cardId };
  }
  if (entry.kind === "printing") {
    return { kind: "printing", printingId: entry.printingId };
  }
  return { kind: "copy", copyId: entry.copyId };
}
