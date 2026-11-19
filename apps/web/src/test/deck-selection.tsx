import type { ReactNode } from "react";

import type { DeckSelectionStore } from "@/features/decks/stores/deck-selection-store";
import {
  createDeckSelectionStore,
  DeckSelectionStoreContext,
} from "@/features/decks/stores/deck-selection-store";

/** A render `wrapper` that mounts its children inside one deck list page's selection store. */
export function deckSelectionWrapper(store: DeckSelectionStore = createDeckSelectionStore()) {
  return function DeckSelectionWrapper({ children }: { children: ReactNode }) {
    return <DeckSelectionStoreContext value={store}>{children}</DeckSelectionStoreContext>;
  };
}
