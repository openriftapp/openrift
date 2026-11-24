import type { QueryClient, StaleTime } from "@tanstack/react-query";
import { onlineManager } from "@tanstack/react-query";

import { mutationsSettled } from "@/lib/mutations-settled";

export const TIER_LIST_SAVE_MUTATION_KEY = ["tier-lists", "save"] as const;

function savesList(variables: unknown, id: string): boolean {
  return (
    typeof variables === "object" && variables !== null && "id" in variables && variables.id === id
  );
}

function hasPendingSave(queryClient: QueryClient, id: string): boolean {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: TIER_LIST_SAVE_MUTATION_KEY, status: "pending" })
    .some((mutation) => !mutation.state.isPaused && savesList(mutation.state.variables, id));
}

/**
 * Resolves once no save of this list is in flight (one paused offline does not count), its refetch
 * included. A loader that read the list earlier would hand its editor the board from before the save.
 */
export function tierListSavesSettled(queryClient: QueryClient, id: string): Promise<void> {
  return mutationsSettled(queryClient.getMutationCache(), () => hasPendingSave(queryClient, id));
}

/** Entry reads the list fresh; offline it takes the cached board, and the open page refetches on reconnect. */
export function tierListEntryStaleTime(): StaleTime {
  return onlineManager.isOnline() ? 0 : "static";
}
