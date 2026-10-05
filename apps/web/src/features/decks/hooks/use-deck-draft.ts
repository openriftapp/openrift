import type { Collection } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { useIsLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { DeckSaveStatus } from "@/features/decks/stores/deck-draft-store";
import {
  CLEAN_STATUS,
  LOCAL_SCOPE,
  getDeckDraftCollection,
  getDeckDraftHydrated,
  getDeckDraftStatus,
  subscribeToDeckDraft,
} from "@/features/decks/stores/deck-draft-store";
import { useUserId } from "@/hooks/use-session";

export function useDeckDraftHydrated(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
): boolean {
  return useSyncExternalStore(
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- external-store subscribe signature
    (listener) => subscribeToDeckDraft(queryClient, userId, deckId, listener),
    () => getDeckDraftHydrated(queryClient, userId, deckId),
    () => false,
  );
}

export function useDeckDraftCollection(
  deckId: string,
): Collection<DeckBuilderCard, string | number> | null {
  const queryClient = useQueryClient();
  const scope = useDeckDraftScope(deckId);
  return scope ? getDeckDraftCollection(queryClient, scope, deckId) : null;
}

export function useDeckDraftScope(deckId: string): string | null {
  const userId = useUserId();
  const isLocal = useIsLocalDeck(deckId);
  return isLocal ? LOCAL_SCOPE : userId;
}

export function useDeckSaveStatus(
  queryClient: QueryClient,
  userId: string,
  deckId: string,
): DeckSaveStatus {
  return useSyncExternalStore(
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- external-store subscribe signature
    (listener) => subscribeToDeckDraft(queryClient, userId, deckId, listener),
    () => getDeckDraftStatus(queryClient, userId, deckId),
    () => CLEAN_STATUS,
  );
}
