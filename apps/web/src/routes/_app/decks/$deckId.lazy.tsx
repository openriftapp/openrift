import { createLazyFileRoute } from "@tanstack/react-router";

import { FilterSearchProvider } from "@/features/cards/lib/search-schemas";
import { DeckEditorPage } from "@/features/decks/components/deck-editor-page";
import { ViewSurfaceProvider } from "@/hooks/use-view-prefs";

export const Route = createLazyFileRoute("/_app/decks/$deckId")({
  component: DeckEditor,
});

function DeckEditor() {
  const { deckId } = Route.useParams();
  const search = Route.useSearch();
  return (
    <ViewSurfaceProvider value="deckBrowser">
      <FilterSearchProvider value={search}>
        <DeckEditorPage key={deckId} deckId={deckId} />
      </FilterSearchProvider>
    </ViewSurfaceProvider>
  );
}
