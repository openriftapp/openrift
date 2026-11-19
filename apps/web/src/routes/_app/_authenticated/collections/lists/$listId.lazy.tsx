import { createLazyFileRoute } from "@tanstack/react-router";

import { ListPage } from "@/features/lists/components/list-page";

export const Route = createLazyFileRoute("/_app/_authenticated/collections/lists/$listId")({
  component: ListDetail,
});

function ListDetail() {
  const { listId } = Route.useParams();
  return <ListPage listId={listId} />;
}
