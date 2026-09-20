import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { eq, useLiveQuery } from "@tanstack/react-db";

import { useCollectionsCollection } from "@/features/collections/hooks/use-collections-collection";

/**
 * Resolves the collection a deck is stored in. Safe with no signed-in
 * viewer: an anonymous viewer has no collections to match against.
 */
export function useHomeCollection(collectionId?: string | null): CollectionResponse | undefined {
  const collectionsCollection = useCollectionsCollection();
  // No store to read during SSR.
  const { data, isReady } = useLiveQuery({
    query: (q) =>
      globalThis.window === undefined || !collectionsCollection || !collectionId
        ? null
        : q
            .from({ collection: collectionsCollection })
            .where(({ collection }) => eq(collection.id, collectionId))
            .findOne(),
  });
  if (!isReady) {
    return undefined;
  }
  return data;
}
