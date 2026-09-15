import { createLazyFileRoute } from "@tanstack/react-router";

import { BoardStateView } from "@/features/rules/components/board-state-view";
import { usePublicBoardState } from "@/features/rules/hooks/use-board-states";

export const Route = createLazyFileRoute("/_app/board/$token")({
  component: SharedBoardStatePage,
});

function SharedBoardStatePage() {
  const { token } = Route.useParams();
  const { data } = usePublicBoardState(token);
  return <BoardStateView boardState={data.boardState} ownerName={data.owner.displayName} />;
}
