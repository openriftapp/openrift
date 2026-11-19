import { createLazyFileRoute } from "@tanstack/react-router";

import { CollectionGrid } from "@/features/collections/components/collection-grid";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/_authenticated/collections/")({
  component: CollectionIndex,
});

function CollectionIndex() {
  return <CollectionGrid title={m.collections_all_cards()} />;
}
