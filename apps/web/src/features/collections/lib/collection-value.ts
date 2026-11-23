import { centsToDollars } from "@openrift/shared/money";
import type {
  CollectionResponse,
  PublicCollectionResponse,
} from "@openrift/shared/types/api/collection";

import { formatterForMarketplace } from "@/lib/format";

/** Excludes shared group collections: their copies are communal, not the viewer's own. */
export function aggregatePersonalCollectionValue(collections: readonly CollectionResponse[]): {
  valueCents: number;
  unpricedCount: number;
} {
  return collections.reduce(
    (acc, collection) => {
      if (collection.groupId) {
        return acc;
      }
      return {
        valueCents: acc.valueCents + (collection.totalValueCents ?? 0),
        unpricedCount: acc.unpricedCount + (collection.unpricedCopyCount ?? 0),
      };
    },
    { valueCents: 0, unpricedCount: 0 },
  );
}

export function formatSharedCollectionValue(
  collection: Pick<PublicCollectionResponse, "totalValueCents" | "valueMarketplace">,
): string | null {
  return collection.totalValueCents === null
    ? null
    : formatterForMarketplace(collection.valueMarketplace)(
        centsToDollars(collection.totalValueCents),
      );
}
