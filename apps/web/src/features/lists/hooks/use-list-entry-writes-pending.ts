import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { useMutationState, useQueryClient } from "@tanstack/react-query";

import type { BulkAddVariables } from "@/features/lists/lib/list-entry-writes";
import {
  LIST_ENTRY_MUTATION_KEYS,
  listEntryWritePending,
  pendingListEntryWrites,
} from "@/features/lists/lib/list-entry-writes";

interface EntryWrite {
  listId: string;
  entryId: string;
}

/**
 * Answers per entry whether a quantity write for it is still in flight, across every row. A call
 * from a handler also sees a write started earlier in the same frame, before any re-render.
 */
export function useListEntryWritesPending(
  listId: string,
  entries: readonly ListEntryDetailResponse[],
): (entryId: string) => boolean {
  const queryClient = useQueryClient();
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
    if (entry === undefined) {
      return false;
    }
    const identity = { ...entry, id: entryId };
    return (
      listEntryWritePending(listId, identity, writes) ||
      listEntryWritePending(
        listId,
        identity,
        pendingListEntryWrites(queryClient.getMutationCache()),
      )
    );
  };
}
