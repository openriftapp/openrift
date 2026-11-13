import { createLazyFileRoute } from "@tanstack/react-router";

import { MetaEventPlayersPage } from "@/features/admin/components/meta-event-players-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/meta_/$eventId")({
  component: MetaEventDecksRoute,
});

function MetaEventDecksRoute() {
  const { eventId } = Route.useParams();
  return <MetaEventPlayersPage key={eventId} eventId={eventId} />;
}
