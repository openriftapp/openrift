import { createLazyFileRoute } from "@tanstack/react-router";

import { NewBoardStatePage } from "@/features/rules/components/board-state-editor-page";

export const Route = createLazyFileRoute("/_app/board-states_/new")({
  component: NewBoardStatePage,
});
