// Collection identity is tied to (queryClient, userId): a user change evicts the previous
// entry, which is cleaned up once its last reader detaches.

import { deckFoldersContract } from "@openrift/shared/contracts/deck-folders";
import { decksContract } from "@openrift/shared/contracts/decks";
import type {
  DeckCardWithDeckResponse,
  DeckCardsListResponse,
  DeckFolderResponse,
  DeckListItemResponse,
} from "@openrift/shared/types/api/deck";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { BasicIndex, createCollection } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";

import { cleanupWhenIdle, markOrphaned } from "@/features/collections/lib/collection-cleanup";
import { watchFailedLoad } from "@/features/collections/lib/collection-load-failure";
import { dropCardsOfMissingDecks, mergeDeckCardsDelta } from "@/features/decks/lib/deck-card-rows";
import { deckFoldersKeys, decksKeys } from "@/features/decks/lib/decks-query-keys";
import type {
  DeckCardsCollection,
  DeckFoldersCollection,
  DecksCollection,
} from "@/features/decks/lib/decks-write";
import {
  deckCardRowKey,
  persistDeckCardMutations,
  persistDeckFolderMutations,
  persistDeckMutations,
} from "@/features/decks/lib/decks-write";
import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";
import { m } from "@/paraglide/messages.js";

interface CacheEntry<T> {
  userId: string;
  collection: T;
}

const decksCache = new WeakMap<QueryClient, CacheEntry<DecksCollection>>();
const cardsCache = new WeakMap<QueryClient, CacheEntry<DeckCardsCollection>>();
const foldersCache = new WeakMap<QueryClient, CacheEntry<DeckFoldersCollection>>();

function syncedDeckIds(queryClient: QueryClient, userId: string): Set<string> | undefined {
  const rows = queryClient.getQueryData<DeckListItemResponse[]>([...decksKeys.syncedStore(userId)]);
  return rows === undefined ? undefined : new Set(rows.map((row) => row.deck.id));
}

export function getDecksCollection(queryClient: QueryClient, userId: string): DecksCollection {
  const existing = decksCache.get(queryClient);
  if (existing && existing.userId === userId) {
    return existing.collection;
  }
  if (existing) {
    markOrphaned(existing.collection, `decks:${existing.userId}`);
    cleanupWhenIdle(existing.collection);
  }

  const context = { queryClient, userId };
  const collection = createCollection(
    queryCollectionOptions<DeckListItemResponse>({
      id: `decks:${userId}`,
      queryClient,
      queryKey: [...decksKeys.syncedStore(userId)],
      staleTime: 10 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      queryFn: async (ctx) => {
        const response = await browserApiOrpcClient(decksContract).list(
          { includeArchived: "true" },
          { signal: ctx.signal },
        );
        return response.items;
      },
      getKey: (row) => row.deck.id,
      onInsert: async ({ transaction, collection: rows }) => {
        await persistDeckMutations(rows, transaction.mutations, context);
      },
      onUpdate: async ({ transaction, collection: rows }) => {
        await persistDeckMutations(rows, transaction.mutations, context);
      },
      onDelete: async ({ transaction, collection: rows }) => {
        await persistDeckMutations(rows, transaction.mutations, context);
      },
    }),
  );

  watchFailedLoad(collection, m.sync_load_failed_decks);
  decksCache.set(queryClient, { userId, collection });
  return collection;
}

export function getDeckCardsCollection(
  queryClient: QueryClient,
  userId: string,
): DeckCardsCollection {
  const existing = cardsCache.get(queryClient);
  if (existing && existing.userId === userId) {
    return existing.collection;
  }
  if (existing) {
    markOrphaned(existing.collection, `deck-cards:${existing.userId}`);
    cleanupWhenIdle(existing.collection);
  }

  const context = { queryClient, userId };
  // Per collection instance, so a user switch starts from a full read.
  let cardsSyncedXid: string | undefined;
  const collection = createCollection(
    queryCollectionOptions<DeckCardWithDeckResponse>({
      id: `deck-cards:${userId}`,
      queryClient,
      queryKey: [...decksKeys.cardsStore(userId)],
      staleTime: 10 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      queryFn: async (ctx) => {
        const previous = queryClient.getQueryData<DeckCardWithDeckResponse[]>([
          ...decksKeys.cardsStore(userId),
        ]);
        const since = previous === undefined ? undefined : cardsSyncedXid;
        const client = browserApiOrpcClient(decksContract);
        const items: DeckCardWithDeckResponse[] = [];
        let touchedDeckIds: string[] | undefined;
        let syncedXid: string | undefined;
        let cursor: string | null = null;
        // Every page is accumulated before the merge: it replaces a deck wholesale,
        // so merging a page at a time would drop the cards still to come.
        do {
          const response: DeckCardsListResponse = await client.allCards(
            {
              ...(since === undefined ? {} : { since }),
              ...(cursor === null ? {} : { cursor }),
            },
            { signal: ctx.signal },
          );
          items.push(...response.items);
          if (response.touchedDeckIds !== undefined) {
            touchedDeckIds = [...(touchedDeckIds ?? []), ...response.touchedDeckIds];
          }
          syncedXid ??= response.syncedXid;
          cursor = response.nextCursor ?? null;
        } while (cursor !== null);
        cardsSyncedXid = syncedXid ?? cardsSyncedXid;
        if (previous === undefined || touchedDeckIds === undefined) {
          return items;
        }
        // A deck deleted elsewhere returns neither rows nor a touched id. Only earlier rows are
        // checked: the decks list refetches in parallel and can still lack a deck this read delivered.
        const liveDeckIds = syncedDeckIds(queryClient, userId);
        const kept =
          liveDeckIds === undefined ? previous : dropCardsOfMissingDecks(previous, liveDeckIds);
        return mergeDeckCardsDelta(kept, items, touchedDeckIds);
      },
      getKey: (row) => deckCardRowKey(row),
      onInsert: async ({ transaction, collection: rows }) => {
        await persistDeckCardMutations(rows, transaction.mutations, context);
      },
      onUpdate: async ({ transaction, collection: rows }) => {
        await persistDeckCardMutations(rows, transaction.mutations, context);
      },
      onDelete: async ({ transaction, collection: rows }) => {
        await persistDeckCardMutations(rows, transaction.mutations, context);
      },
    }),
  );
  collection.createIndex((row) => row.deckId, { indexType: BasicIndex });

  watchFailedLoad(collection, m.sync_load_failed_deck_cards);
  cardsCache.set(queryClient, { userId, collection });
  return collection;
}

export function getDeckFoldersCollection(
  queryClient: QueryClient,
  userId: string,
): DeckFoldersCollection {
  const existing = foldersCache.get(queryClient);
  if (existing && existing.userId === userId) {
    return existing.collection;
  }
  if (existing) {
    markOrphaned(existing.collection, `deck-folders:${existing.userId}`);
    cleanupWhenIdle(existing.collection);
  }

  const context = { queryClient, userId };
  const collection = createCollection(
    queryCollectionOptions<DeckFolderResponse>({
      id: `deck-folders:${userId}`,
      queryClient,
      queryKey: [...deckFoldersKeys.syncedStore(userId)],
      staleTime: 10 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      queryFn: async (ctx) => {
        const response = await browserApiOrpcClient(deckFoldersContract).list(undefined, {
          signal: ctx.signal,
        });
        return response.items;
      },
      getKey: (row) => row.id,
      onInsert: async ({ transaction, collection: folders }) => {
        await persistDeckFolderMutations(transaction.mutations, context);
        await folders.utils.refetch();
      },
      onUpdate: async ({ transaction, collection: folders }) => {
        await persistDeckFolderMutations(transaction.mutations, context);
        await folders.utils.refetch();
      },
      onDelete: async ({ transaction, collection: folders }) => {
        await persistDeckFolderMutations(transaction.mutations, context);
        await folders.utils.refetch();
      },
    }),
  );

  watchFailedLoad(collection, m.sync_load_failed_deck_folders);
  foldersCache.set(queryClient, { userId, collection });
  return collection;
}

/** A fetch lands in the query cache first; the store applies it on the next notify flush or subscriber. */
export function deckInStore(queryClient: QueryClient, userId: string, deckId: string): boolean {
  if (getDecksCollection(queryClient, userId).has(deckId)) {
    return true;
  }
  const cached = queryClient.getQueryData<DeckListItemResponse[]>([
    ...decksKeys.syncedStore(userId),
  ]);
  return cached?.some((row) => row.deck.id === deckId) ?? false;
}

/** Reads both stores from the server once, for a deck that reached it outside their write path. */
export async function refreshDeckStores(queryClient: QueryClient, userId: string): Promise<void> {
  await Promise.all([
    getDecksCollection(queryClient, userId).utils.refetch(),
    getDeckCardsCollection(queryClient, userId).utils.refetch(),
  ]);
}
