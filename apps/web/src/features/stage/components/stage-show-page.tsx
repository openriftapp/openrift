import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Suspense } from "react";

import { DeckPresentation } from "@/features/stage/components/deck-presentation";
import { QueuePresentation } from "@/features/stage/components/queue-presentation";
import { StageShellFallback } from "@/features/stage/components/stage-shell-fallback";
import {
  OwnedTierListPresentation,
  SharedTierListPresentation,
} from "@/features/stage/components/tier-list-presentation";
import { useApplyStagePreset } from "@/features/stage/hooks/use-apply-stage-preset";
import { presentedQueue } from "@/features/stage/lib/presentation-queue-search";

const routeApi = getRouteApi("/_app/stage_/show");

export function StageShowPage() {
  const search = routeApi.useSearch();
  const { deck, tier, tierShare, zone, i, mode, preset } = search;
  const navigate = useNavigate();
  useApplyStagePreset(preset);

  const setIndex = (index: number) => {
    // `replace` so a walk through 40 cards doesn't bury the page the creator
    // came from under 40 history entries.
    void navigate({ to: "/stage/show", search: (prev) => ({ ...prev, i: index }), replace: true });
  };

  if (deck) {
    return (
      <Suspense fallback={<StageShellFallback />}>
        <DeckPresentation
          deckId={deck}
          zone={zone}
          index={i ?? 0}
          onIndexChange={setIndex}
          onExit={() => {
            void navigate({ to: "/decks/$deckId", params: { deckId: deck } });
          }}
        />
      </Suspense>
    );
  }

  if (tier) {
    return (
      <Suspense fallback={<StageShellFallback />}>
        <OwnedTierListPresentation
          tierListId={tier}
          index={i ?? 0}
          editing={mode === "edit"}
          onEditingChange={(next) => {
            // `replace` so flipping between ranking and showing during a segment
            // doesn't build a history stack the back button has to climb.
            void navigate({
              to: "/stage/show",
              search: (prev) => ({ ...prev, mode: next ? "edit" : undefined }),
              replace: true,
            });
          }}
          onIndexChange={setIndex}
          onExit={() => {
            void navigate({ to: "/tier-lists/$tierListId", params: { tierListId: tier } });
          }}
        />
      </Suspense>
    );
  }

  if (tierShare) {
    return (
      <Suspense fallback={<StageShellFallback />}>
        <SharedTierListPresentation
          token={tierShare}
          index={i ?? 0}
          onIndexChange={setIndex}
          onExit={() => {
            void navigate({ to: "/tier-lists/share/$token", params: { token: tierShare } });
          }}
        />
      </Suspense>
    );
  }

  // The `_app` gate sends a show with nothing to present back to the builder.
  const presented = presentedQueue(search);
  if (!presented) {
    return null;
  }
  return (
    <Suspense fallback={<StageShellFallback />}>
      <QueuePresentation
        printingIds={presented}
        index={i ?? 0}
        onIndexChange={setIndex}
        onExit={() => {
          void navigate({
            to: "/stage",
            search: (prev) => ({ ...prev, edit: true, i: undefined }),
          });
        }}
      />
    </Suspense>
  );
}
