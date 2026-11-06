import { useDeckSelectionStore } from "@/features/decks/stores/deck-selection-store";

export function useDeckSelectState(
  deckId: string,
  isLocal: boolean,
): { selectMode: boolean; selected: boolean } {
  const selectMode = useDeckSelectionStore((state) => state.selectMode) && !isLocal;
  const selected = useDeckSelectionStore((state) => state.selected.has(deckId));
  return { selectMode, selected: selectMode && selected };
}
