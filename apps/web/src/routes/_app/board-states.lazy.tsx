import { createLazyFileRoute } from "@tanstack/react-router";

import { BoardStatesIndexPage } from "@/features/board-states/components/board-states-index-page";

export const Route = createLazyFileRoute("/_app/board-states")({
  component: BoardStatesIndexPage,
});
