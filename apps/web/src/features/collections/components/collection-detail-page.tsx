import { useNavigate, getRouteApi } from "@tanstack/react-router";

import { CollectionGrid } from "@/features/collections/components/collection-grid";
import { useCollectionsMap } from "@/features/collections/hooks/use-collections";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/_authenticated/collections/$collectionId");

export function CollectionDetailPage() {
  const { collectionId } = routeApi.useParams();
  const { wanted } = routeApi.useSearch();
  const navigate = useNavigate();
  const collectionsMap = useCollectionsMap();
  const collection = collectionsMap.get(collectionId);
  return (
    <CollectionGrid
      collectionId={collectionId}
      title={collection?.name ?? m.collections_fallback_title()}
      wantedOnly={wanted === true}
      // Off drops the key so the URL only carries the filter when active.
      // Replaces the history entry: a toggle isn't a back-button stop.
      onWantedOnlyChange={(next) => {
        void navigate({
          to: "/collections/$collectionId",
          params: { collectionId },
          search: (prev) => ({ ...prev, wanted: next ? true : undefined }),
          replace: true,
        });
      }}
    />
  );
}
