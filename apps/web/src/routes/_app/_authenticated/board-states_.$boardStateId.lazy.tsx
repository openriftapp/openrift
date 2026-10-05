import { createLazyFileRoute } from "@tanstack/react-router";

import { BoardStateEditorPage } from "@/features/board-states/components/board-state-editor-page";
import { useBoardState } from "@/features/board-states/hooks/use-board-states";

export const Route = createLazyFileRoute("/_app/_authenticated/board-states_/$boardStateId")({
  component: BoardStateEditorRoute,
});

function BoardStateEditorRoute() {
  const { boardStateId } = Route.useParams();
  const { data } = useBoardState(boardStateId);
  return <BoardStateEditorPage key={boardStateId} boardState={data} />;
}
