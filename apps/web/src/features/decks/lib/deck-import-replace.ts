export type ReplaceTarget =
  | { mode: "none" }
  | { mode: "local"; deckId: string }
  | { mode: "server"; deckId: string };

/**
 * A browser-local deck must never go through the server (404s on an id it has
 * never seen); an id in neither place degrades to plain import instead.
 */
export function resolveReplaceTarget(
  replaceDeckId: string | undefined,
  hasSession: boolean,
  localDeckExists: (id: string) => boolean,
): ReplaceTarget {
  if (!replaceDeckId) {
    return { mode: "none" };
  }
  if (localDeckExists(replaceDeckId)) {
    return { mode: "local", deckId: replaceDeckId };
  }
  return hasSession ? { mode: "server", deckId: replaceDeckId } : { mode: "none" };
}
