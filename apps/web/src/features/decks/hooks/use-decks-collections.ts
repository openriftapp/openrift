import { useQueryClient } from "@tanstack/react-query";

import {
  getDeckCardsCollection,
  getDeckFoldersCollection,
  getDecksCollection,
} from "@/features/decks/lib/decks-collection";
import type {
  DeckCardsCollection,
  DeckFoldersCollection,
  DecksCollection,
} from "@/features/decks/lib/decks-write";
import { useSession } from "@/lib/auth-session";

export function useDecksCollection(): DecksCollection | null {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id ?? null;
  return userId ? getDecksCollection(queryClient, userId) : null;
}

export function useDeckCardsCollection(): DeckCardsCollection | null {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id ?? null;
  return userId ? getDeckCardsCollection(queryClient, userId) : null;
}

export function useDeckFoldersCollection(): DeckFoldersCollection | null {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id ?? null;
  return userId ? getDeckFoldersCollection(queryClient, userId) : null;
}
