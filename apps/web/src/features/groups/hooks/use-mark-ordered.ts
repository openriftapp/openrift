import { useState } from "react";

import {
  useCollectionsList,
  useCreateCollection,
} from "@/features/collections/hooks/use-collections";
import { useAddCopies } from "@/features/collections/hooks/use-copies";
import type { BuyCartItem } from "@/features/groups/lib/buy-cart";
import { fileOrder, findOrderedCollection } from "@/features/groups/lib/buy-cart";
import type { WantedCard } from "@/features/groups/lib/wanted-cards";
import { useDecrementListEntries } from "@/features/lists/hooks/use-lists";
import { m } from "@/paraglide/messages.js";

export function useMarkOrdered() {
  const collections = useCollectionsList();
  const createCollection = useCreateCollection();
  const addCopies = useAddCopies();
  const decrementEntries = useDecrementListEntries();
  const [pending, setPending] = useState(false);

  const orderedCollection = findOrderedCollection(collections ?? []);

  const collectionId = async (): Promise<string> => {
    if (orderedCollection !== undefined) {
      return orderedCollection.id;
    }
    const created = await createCollection.mutateAsync({
      name: m.trades_buy_ordered_collection_name(),
      availableForDeckbuilding: false,
      purpose: "marketplace_orders",
    });
    return created.id;
  };

  const markOrdered = async (
    items: readonly BuyCartItem[],
    wantedByKey: ReadonlyMap<string, WantedCard>,
  ): Promise<boolean> => {
    setPending(true);
    const done = await fileOrder(
      {
        collectionId,
        addCopies: (copies) => addCopies.mutateAsync({ copies }),
        decrementEntries: (entries) => decrementEntries.mutateAsync({ entries }),
      },
      items,
      wantedByKey,
    ).then(
      () => true,
      // Reported by the global mutation error toast.
      () => false,
    );
    setPending(false);
    return done;
  };

  return { markOrdered, pending, orderedCollection, ready: collections !== undefined };
}
