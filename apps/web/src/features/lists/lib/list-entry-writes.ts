import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { MutationCache } from "@tanstack/react-query";

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

type EntryQuantity = Pick<ListEntryDetailResponse, "kind" | "id" | "quantity" | "ruleQuantity">;

/** The entry's own quantity, which an entry update writes. A card or printing total adds the rules' part. */
export function manualQuantity(entry: EntryQuantity): number {
  if (entry.id === null) {
    return 0;
  }
  return entry.kind === "copy" ? entry.quantity : entry.quantity - entry.ruleQuantity;
}

export function totalQuantity(entry: EntryQuantity, manual: number): number {
  return entry.kind === "copy" ? manual : manual + entry.ruleQuantity;
}

/** The entry writes in flight right now, read from the cache at call time. */
export function pendingListEntryWrites(mutationCache: MutationCache): PendingListEntryWrites {
  const variablesOf = (mutationKey: readonly string[]) =>
    mutationCache
      .findAll({ mutationKey, status: "pending" })
      .map((mutation) => mutation.state.variables);
  return {
    adds: variablesOf(LIST_ENTRY_MUTATION_KEYS.add) as BulkAddVariables[],
    entryWrites: [
      ...variablesOf(LIST_ENTRY_MUTATION_KEYS.update),
      ...variablesOf(LIST_ENTRY_MUTATION_KEYS.remove),
    ] as { listId: string; entryId: string }[],
  };
}

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
