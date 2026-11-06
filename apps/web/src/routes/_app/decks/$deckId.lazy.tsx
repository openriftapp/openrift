import { createLazyFileRoute } from "@tanstack/react-router";

import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { DeckEditorPage } from "@/features/decks/components/deck-editor-page";
import { WorkbenchEditorPage } from "@/features/decks/components/workbench-editor-page";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { useSession } from "@/hooks/use-session";
import { ViewSurfaceProvider } from "@/hooks/use-view-prefs";

export const Route = createLazyFileRoute("/_app/decks/$deckId")({
  component: DeckEditor,
});

function DeckEditor() {
  const { deckId } = Route.useParams();
  const search = Route.useSearch();
  const { data: session } = useSession();
  const betaEnabled = useFeatureEnabled("deck-builder-beta");
  const useWorkbench = betaEnabled && Boolean(session?.user);
  return (
    <ViewSurfaceProvider value="deckBrowser">
      <FilterSearchProvider value={search}>
        {useWorkbench ? (
          <WorkbenchEditorPage key={deckId} deckId={deckId} />
        ) : (
          <DeckEditorPage key={deckId} deckId={deckId} />
        )}
      </FilterSearchProvider>
    </ViewSurfaceProvider>
  );
}
