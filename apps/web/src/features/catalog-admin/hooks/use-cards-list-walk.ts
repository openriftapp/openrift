import type { CatalogCardRow } from "@openrift/shared/contracts/admin/catalog-review";
import { useNavigate } from "@tanstack/react-router";

import { useIsAdmin } from "@/features/admin/hooks/use-admin";
import { useUnifiedMappingsWhen } from "@/features/admin/hooks/use-unified-mappings";
import { buildPriceAssignBucketsBySlug } from "@/features/cards/lib/marketplace-coverage";
import { useCatalogCardsWhen } from "@/features/catalog-admin/hooks/use-catalog-list";
import type {
  CardsListSearch,
  CardsListSearchInput,
} from "@/features/catalog-admin/lib/catalog-card-list";
import {
  cardsListParams,
  cardsListSearch,
  catalogCardNeighbours,
  selectCatalogCards,
} from "@/features/catalog-admin/lib/catalog-card-list";
import type { CatalogTab } from "@/features/catalog-admin/lib/catalog-tabs";
import { DEFAULT_CATALOG_TAB } from "@/features/catalog-admin/lib/catalog-tabs";

export interface CardsListWalk {
  hasPrev: boolean;
  hasNext: boolean;
  go: (direction: "prev" | "next") => void;
  listSearch: CardsListSearch;
}

export function useCardsListWalk({
  enabled,
  key,
  search,
  tab,
}: {
  enabled: boolean;
  key: string;
  search: CardsListSearchInput;
  tab?: CatalogTab;
}): CardsListWalk {
  const navigate = useNavigate();
  const { data: isAdmin } = useIsAdmin();
  const { data: cardList } = useCatalogCardsWhen(enabled);
  const params = cardsListParams(search, isAdmin === true);
  const needsBuckets = enabled && params.issue === "unlinked-products";
  const { data: mappings } = useUnifiedMappingsWhen(needsBuckets && isAdmin === true);

  const bucketsBySlug = buildPriceAssignBucketsBySlug(mappings?.groups ?? []);
  const rows = selectCatalogCards(cardList?.rows ?? [], {
    ...params,
    buckets: mappings
      ? (cardSlug) => (cardSlug === null ? undefined : bucketsBySlug.get(cardSlug))
      : undefined,
  });
  const neighbours = catalogCardNeighbours(rows, key);
  const listSearch = cardsListSearch(params);

  function goTo(row: CatalogCardRow | null) {
    if (!row) {
      return;
    }
    if (row.cardSlug === null) {
      void navigate({
        to: "/admin/catalog/drafts/$name",
        params: { name: row.normName },
        search: listSearch,
      });
      return;
    }
    void navigate({
      to: "/admin/catalog/cards/$cardSlug",
      params: { cardSlug: row.cardSlug },
      search: {
        ...listSearch,
        tab: tab === undefined || tab === DEFAULT_CATALOG_TAB ? undefined : tab,
      },
    });
  }

  return {
    hasPrev: neighbours.prev !== null,
    hasNext: neighbours.next !== null,
    go: (direction) => goTo(direction === "prev" ? neighbours.prev : neighbours.next),
    listSearch,
  };
}
