import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { useMutationState } from "@tanstack/react-query";

import type { BulkAddVariables } from "@/features/lists/lib/list-entry-writes";
import {
  LIST_ENTRY_MUTATION_KEYS,
  listEntryWritePending,
} from "@/features/lists/lib/list-entry-writes";

interface EntryWrite {
  listId: string;
  entryId: string;
}

/** Answers per entry whether a quantity write for it is still in flight, across every row. */
export function useListEntryWritesPending(
  listId: string,
  entries: readonly ListEntryDetailResponse[],
): (entryId: string) => boolean {
  const adds = useMutationState({
    filters: { mutationKey: LIST_ENTRY_MUTATION_KEYS.add, status: "pending" },
    select: (mutation) => mutation.state.variables as BulkAddVariables,
  });
  const updates = useMutationState({
    filters: { mutationKey: LIST_ENTRY_MUTATION_KEYS.update, status: "pending" },
    select: (mutation) => mutation.state.variables as EntryWrite,
  });
  const removes = useMutationState({
    filters: { mutationKey: LIST_ENTRY_MUTATION_KEYS.remove, status: "pending" },
    select: (mutation) => mutation.state.variables as EntryWrite,
  });
  const writes = { adds, entryWrites: [...updates, ...removes] };
  const entryById = new Map(
    entries.flatMap((entry) => (entry.id === null ? [] : [[entry.id, entry] as const])),
  );

  return (entryId) => {
    const entry = entryById.get(entryId);
    return entry !== undefined && listEntryWritePending(listId, { ...entry, id: entryId }, writes);
  };
}
