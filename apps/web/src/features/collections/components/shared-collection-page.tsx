import { getRouteApi } from "@tanstack/react-router";

import { PublicShareCta } from "@/components/signed-out-cta";
import { SharedCollectionAccessRedirect } from "@/features/collections/components/shared-collection-access-redirect";
import { SharedCollectionView } from "@/features/collections/components/shared-collection-view";
import { usePublicCollection } from "@/features/collections/hooks/use-collections";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/collections_/share/$token");

export function SharedCollectionPage() {
  const { token } = routeApi.useParams();
  const { data } = usePublicCollection(token);
  const search = routeApi.useSearch();

  return (
    <SharedCollectionView
      data={data}
      search={search}
      notice={
        <>
          <SharedCollectionAccessRedirect collectionId={data.collection.id} />
          <PublicShareCta title={m.collections_share_cta_title()}>
            {m.collections_share_cta_body()}
          </PublicShareCta>
        </>
      }
    />
  );
}
