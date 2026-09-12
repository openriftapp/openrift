import { createLazyFileRoute } from "@tanstack/react-router";

import { PublicShareCta } from "@/features/account/components/signed-out-cta";
import { SharedCollectionAccessRedirect } from "@/features/collections/components/shared-collection-access-redirect";
import { SharedCollectionView } from "@/features/collections/components/shared-collection-view";
import { usePublicCollection } from "@/features/collections/hooks/use-collections";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/collections_/share/$token")({
  component: SharedCollectionPage,
});

function SharedCollectionPage() {
  const { token } = Route.useParams();
  const { data } = usePublicCollection(token);
  const search = Route.useSearch();

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
