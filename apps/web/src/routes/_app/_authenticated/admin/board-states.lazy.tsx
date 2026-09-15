import { createLazyFileRoute } from "@tanstack/react-router";

import { AdminBoardStatesPage } from "@/features/admin/components/admin-board-states-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/board-states")({
  component: AdminBoardStatesPage,
});
