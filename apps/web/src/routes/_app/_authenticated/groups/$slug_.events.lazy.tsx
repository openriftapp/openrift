import { createLazyFileRoute } from "@tanstack/react-router";

import { GroupTournamentsPage } from "@/features/groups/components/group-tournaments-page";

export const Route = createLazyFileRoute("/_app/_authenticated/groups/$slug_/events")({
  component: GroupTournamentsPage,
});
