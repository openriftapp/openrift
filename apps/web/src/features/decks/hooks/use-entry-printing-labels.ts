import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { entryPrintingLabels } from "@/features/decks/lib/deck-entry-printing-labels";
import { useEnumOrders } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

export function useEntryPrintingLabels(): (
  entries: readonly DeckBuilderCard[],
) => Map<string, string> {
  const { getPreferredPrinting } = usePreferredPrinting();
  const { labels } = useEnumOrders();
  return (entries) =>
    entryPrintingLabels(
      entries,
      getPreferredPrinting,
      {
        ...labels,
        flags: { overnumbered: m.cards_flag_overnumbered(), signed: m.cards_flag_signed() },
        onOneSide: (part) => m.cards_printing_part_one_side({ part }),
      },
      m.decks_editor_printing_standard(),
      m.decks_editor_printing_default(),
    );
}
