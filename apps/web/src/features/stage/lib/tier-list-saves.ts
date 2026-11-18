import type { QueryClient } from "@tanstack/react-query";

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
  if (!hasPendingSave(queryClient, id)) {
    return Promise.resolve();
  }
  // oxlint-disable-next-line promise/avoid-new -- settles from the mutation cache's subscription callback
  return new Promise((resolve) => {
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      if (!hasPendingSave(queryClient, id)) {
        unsubscribe();
        resolve();
      }
    });
  });
}
