import { createLazyFileRoute } from "@tanstack/react-router";

import { BoardStatesIndexPage } from "@/features/rules/components/board-states-index-page";

export const Route = createLazyFileRoute("/_app/board-states")({
  component: BoardStatesIndexPage,
});
