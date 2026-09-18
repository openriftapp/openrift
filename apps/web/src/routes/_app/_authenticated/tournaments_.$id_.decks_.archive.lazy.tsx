import { createLazyFileRoute } from "@tanstack/react-router";

import { ArchiveListsPage } from "@/features/tournaments/components/archive-lists-page";

export const Route = createLazyFileRoute("/_app/_authenticated/tournaments_/$id_/decks_/archive")({
  component: TournamentArchiveListsRoute,
});

function TournamentArchiveListsRoute() {
  const { id } = Route.useParams();
  return <ArchiveListsPage tournamentId={id} />;
}
