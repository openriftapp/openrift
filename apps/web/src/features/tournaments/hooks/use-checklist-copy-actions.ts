import type { DeckCheckEntryCardResponse } from "@openrift/shared/types/api/deck-check";
import { useState } from "react";
import { toast } from "sonner";

import {
  useRemoveTournamentDeckCheckCard,
  useTickTournamentDeckCheckCard,
} from "@/features/tournaments/hooks/use-tournament-deck-check";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

interface ChecklistCopy {
  tournamentId: string;
  entryId: string;
  card: DeckCheckEntryCardResponse;
  copyIndex: number;
  tickLocked: boolean;
  onStale: () => void;
}

export function useChecklistCopyActions({
  tournamentId,
  entryId,
  card,
  copyIndex,
  tickLocked,
  onStale,
}: ChecklistCopy) {
  const tickCard = useTickTournamentDeckCheckCard();
  const removeCard = useRemoveTournamentDeckCheckCard();
  const [removeOpen, setRemoveOpen] = useState(false);
  const found = card.foundCopies[copyIndex] === true;

  const toggle = () => {
    if (tickLocked) {
      return;
    }
    tickCard.mutate(
      { tournamentId, entryId, cardId: card.id, copyIndex, found: !found },
      {
        onSuccess: (result) => {
          if (result.status === "stale") {
            toast.info(m.tournaments_deck_check_list_changed());
            onStale();
          }
        },
      },
    );
  };

  const remove = async () => {
    const removed = await runReportedMutation(() =>
      removeCard.mutateAsync({ tournamentId, entryId, cardId: card.id, copyIndex }),
    );
    if (removed) {
      setRemoveOpen(false);
    }
  };

  return {
    found,
    toggle,
    removeOpen,
    setRemoveOpen,
    remove,
    removePending: removeCard.isPending,
  };
}
