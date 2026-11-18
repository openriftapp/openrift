import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { MutationCache } from "@tanstack/react-query";

const LIST_ENTRY_WRITE_KEY = ["lists", "entry-write"] as const;

export const LIST_ENTRY_MUTATION_KEYS = {
  add: [...LIST_ENTRY_WRITE_KEY, "add"],
  update: [...LIST_ENTRY_WRITE_KEY, "update"],
  remove: [...LIST_ENTRY_WRITE_KEY, "remove"],
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

interface EntryWrite {
  listId: string;
  entryId: string;
  quantityDelta?: number;
}

interface PendingListEntryWrites {
  adds: readonly BulkAddVariables[];
  entryWrites: readonly EntryWrite[];
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

/** The manual quantity after a step, floored at 1 as the server does; a copy entry stays at 1. */
export function steppedManualQuantity(entry: EntryQuantity, delta: number): number {
  const manual = manualQuantity(entry);
  return entry.kind === "copy" ? manual : Math.max(1, manual + delta);
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
    ] as EntryWrite[],
  };
}

function writesList(variables: unknown, listId: string): boolean {
  return (
    typeof variables === "object" &&
    variables !== null &&
    "listId" in variables &&
    variables.listId === listId
  );
}

/** Adds, updates and removes in flight on one list; they all rewrite its detail cache. */
export function listEntryWritesInFlight(mutationCache: MutationCache, listId: string): number {
  return mutationCache
    .findAll({ mutationKey: LIST_ENTRY_WRITE_KEY, status: "pending" })
    .filter((mutation) => writesList(mutation.state.variables, listId)).length;
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
 * of the entry, or an add that bumps it. Steps add up on the server, so `countSteps: false`
 * leaves them out for a control that only sends further steps.
 */
export function listEntryWritePending(
  listId: string,
  entry: EntryIdentity & { id: string },
  writes: PendingListEntryWrites,
  options: { countSteps: boolean } = { countSteps: true },
): boolean {
  return (
    writes.entryWrites.some(
      (write) =>
        write.listId === listId &&
        write.entryId === entry.id &&
        (options.countSteps || write.quantityDelta === undefined),
    ) ||
    writes.adds.some(
      (add) => add.listId === listId && add.entries.some((item) => bulkAddItemMatches(item, entry)),
    )
  );
}
