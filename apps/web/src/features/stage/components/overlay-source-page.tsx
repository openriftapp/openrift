import { getRouteApi } from "@tanstack/react-router";

import { useCards } from "@/features/cards/hooks/use-cards";
import { OverlayFrame } from "@/features/stage/components/overlay-frame";
import { useOverlayState } from "@/features/stage/hooks/use-overlay";
import { deriveOverlayBoardScene } from "@/features/stage/lib/overlay-board-scene";
import { useHydrated } from "@/hooks/use-hydrated";

const routeApi = getRouteApi("/stage_/source/$token");

export function OverlaySourcePage() {
  const { token } = routeApi.useParams();
  const { preset } = routeApi.useSearch();
  const hydrated = useHydrated();

  return hydrated && <OverlaySourceCanvas token={token} presetId={preset} />;
}

/** Mount only after hydration: the poll is a browser-direct fetch. */
function OverlaySourceCanvas({ token, presetId }: { token: string; presetId?: string }) {
  const { data } = useOverlayState(token, presetId);
  const { printingsBySideKey, cardsById, printingsByCardId } = useCards();

  if (!data) {
    return null;
  }

  const printingId = data.payload.printingId;
  const pushedBoard = data.payload.board;
  return (
    <div className="fixed inset-0">
      <OverlayFrame
        payload={data.payload}
        printing={printingId === null ? undefined : printingsBySideKey[printingId]}
        board={
          pushedBoard === null
            ? undefined
            : deriveOverlayBoardScene(pushedBoard, cardsById, printingsByCardId)
        }
      />
    </div>
  );
}
