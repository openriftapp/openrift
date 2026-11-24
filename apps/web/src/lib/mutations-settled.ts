import type { MutationCache } from "@tanstack/react-query";

/**
 * Waits for the mutation cache to reach a state where `isPending` is false.
 * @returns A promise that resolves at once when nothing is pending, otherwise on the cache event that clears it.
 */
export function mutationsSettled(
  mutationCache: MutationCache,
  isPending: () => boolean,
): Promise<void> {
  if (!isPending()) {
    return Promise.resolve();
  }
  // oxlint-disable-next-line promise/avoid-new -- settles on a mutation cache event
  return new Promise<void>((resolve) => {
    const unsubscribe = mutationCache.subscribe(() => {
      if (!isPending()) {
        unsubscribe();
        resolve();
      }
    });
  });
}
