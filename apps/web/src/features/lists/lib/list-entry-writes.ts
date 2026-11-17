import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";

export const LIST_ENTRY_MUTATION_KEYS = {
  add: ["lists", "entry-write", "add"],
  update: ["lists", "entry-write", "update"],
  remove: ["lists", "entry-write", "remove"],
} as const;

interface BulkAddItem {
  cardId?: string;
  printingId?: string;
  copyId?: string;
  quantity?: number;
}

export interface BulkAddVariables {
  listId: string;
  entries: BulkAddItem[];
}

interface PendingListEntryWrites {
  adds: readonly BulkAddVariables[];
  entryWrites: readonly { listId: string; entryId: string }[];
}

type EntryIdentity = Pick<ListEntryDetailResponse, "kind"> &
  Partial<Record<"cardId" | "printingId" | "copyId", string | null>>;

export function bulkAddItemMatches(item: BulkAddItem, entry: EntryIdentity): boolean {
  if (item.cardId !== undefined && entry.kind === "card") {
    return entry.cardId === item.cardId;
  }
  if (item.printingId !== undefined && entry.kind === "printing") {
    return entry.printingId === item.printingId;
  }
  if (item.copyId !== undefined && entry.kind === "copy") {
    return entry.copyId === item.copyId;
  }
  return false;
}

/**
 * True while any write that changes this entry's quantity is in flight: an update or remove
 * of the entry, or an add that bumps it.
 */
export function listEntryWritePending(
  listId: string,
  entry: EntryIdentity & { id: string },
  writes: PendingListEntryWrites,
): boolean {
  return (
    writes.entryWrites.some((write) => write.listId === listId && write.entryId === entry.id) ||
    writes.adds.some(
      (add) => add.listId === listId && add.entries.some((item) => bulkAddItemMatches(item, entry)),
    )
  );
}
