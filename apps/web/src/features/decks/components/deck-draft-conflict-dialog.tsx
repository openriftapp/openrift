import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useDeckDraftScope } from "@/features/decks/hooks/use-deck-draft";
import {
  getDeckDraftHasConflict,
  resolveDeckDraftConflict,
  subscribeToDeckDraft,
} from "@/features/decks/stores/deck-draft-store";
import { m } from "@/paraglide/messages.js";

export function DeckDraftConflictDialog({ deckId }: { deckId: string }) {
  const scope = useDeckDraftScope(deckId);
  return scope === null ? null : <ConflictDialog deckId={deckId} scope={scope} />;
}

function ConflictDialog({ deckId, scope }: { deckId: string; scope: string }) {
  const queryClient = useQueryClient();
  const open = useSyncExternalStore(
    (listener) => subscribeToDeckDraft(queryClient, scope, deckId, listener),
    () => getDeckDraftHasConflict(queryClient, scope, deckId),
    () => false,
  );

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resolveDeckDraftConflict(queryClient, scope, deckId, "keep");
        }
      }}
      onConfirm={() => resolveDeckDraftConflict(queryClient, scope, deckId, "load")}
      title={m.decks_editor_conflict_title()}
      description={m.decks_editor_conflict_description()}
      confirmLabel={m.decks_editor_conflict_load()}
      cancelLabel={m.decks_editor_conflict_keep()}
    />
  );
}
