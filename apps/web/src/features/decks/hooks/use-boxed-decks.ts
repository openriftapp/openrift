import { inArray, useLiveQuery } from "@tanstack/react-db";

import { useCollectionsCollection } from "@/features/collections/hooks/use-collections-collection";
import type { DeckFamilyEntry } from "@/features/decks/lib/deck-family";
import { storedDecksShown } from "@/features/decks/lib/deck-family";
import type { BoxedDeck } from "@/features/decks/lib/deck-meta";

export function useBoxedDecks(
  deck: { id: string; name: string; collectionId: string | null },
  family?: DeckFamilyEntry,
): (BoxedDeck & { collectionId: string })[] {
  const stored = storedDecksShown(deck, family);
  const collectionIds = [...new Set(stored.map((entry) => entry.collectionId))];
  const idsKey = collectionIds.join(",");
  const collectionsCollection = useCollectionsCollection();
  // No store to read during SSR.
  const { data } = useLiveQuery(
    (q) =>
      globalThis.window === undefined || !collectionsCollection || collectionIds.length === 0
        ? null
        : q
            .from({ collection: collectionsCollection })
            .where(({ collection }) => inArray(collection.id, collectionIds)),
    [collectionsCollection, idsKey],
  );
  const nameById = new Map((data ?? []).map((collection) => [collection.id, collection.name]));
  return stored.flatMap((entry) => {
    const boxName = nameById.get(entry.collectionId);
    return boxName === undefined ? [] : [{ ...entry, boxName }];
  });
}
