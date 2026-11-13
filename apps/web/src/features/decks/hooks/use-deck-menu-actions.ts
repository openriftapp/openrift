import type { DeckFormat } from "@openrift/shared/types/enums";
import { toast } from "sonner";

import { useCloneDeck, useUpdateDeckMeta } from "@/features/decks/hooks/use-decks";
import { useIsLocalDeck } from "@/features/decks/hooks/use-local-decks";
import { duplicateLocalDeck } from "@/features/decks/lib/local-decks-collection";
import { m } from "@/paraglide/messages.js";

export function useDeckMenuActions(deck: { id: string; name: string }): {
  duplicate: () => void;
  changeFormat: (format: DeckFormat, label: string) => void;
} {
  const isLocal = useIsLocalDeck(deck.id);
  const cloneDeck = useCloneDeck();
  const { update } = useUpdateDeckMeta(deck.id);
  const announceCopy = () => toast.success(m.decks_menu_duplicated({ name: deck.name }));
  return {
    duplicate: () => {
      if (!isLocal) {
        cloneDeck.mutate(deck.id, { onSuccess: announceCopy });
      } else if (duplicateLocalDeck(deck.id)) {
        announceCopy();
      }
    },
    changeFormat: (format, label) =>
      update(
        { format },
        { onSuccess: () => toast.success(m.decks_menu_format_changed({ format: label })) },
      ),
  };
}
