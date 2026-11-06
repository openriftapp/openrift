import { SelectionRowMark } from "@/components/ui/selection-mark";
import { useDeckSelectionStore } from "@/features/decks/stores/deck-selection-store";
import { m } from "@/paraglide/messages.js";

/** Stretches its hit area over the nearest positioned ancestor, so the whole row or tile toggles. */
export function DeckSelectMark({ deckId, deckName }: { deckId: string; deckName: string }) {
  const checked = useDeckSelectionStore((state) => state.selected.has(deckId));
  const toggleSelect = useDeckSelectionStore((state) => state.toggleSelect);
  return (
    <SelectionRowMark
      label={m.decks_selection_select_deck({ name: deckName })}
      checked={checked}
      onCheckedChange={() => toggleSelect(deckId)}
      className="after:absolute after:inset-0"
    />
  );
}
