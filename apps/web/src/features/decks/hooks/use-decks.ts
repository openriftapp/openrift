import type { DeckOddsConfig } from "@openrift/shared/contracts/decks";
import { decksContract } from "@openrift/shared/contracts/decks";
import { publicDecksContract } from "@openrift/shared/contracts/public-decks";
import { descriptionSnippet } from "@openrift/shared/description-snippet";
import type {
  DeckCardWithDeckResponse,
  DeckCloneResponse,
  DeckDetailResponse,
  DeckExportResponse,
  DeckFormatConfig,
  DeckLink,
  DeckListItemResponse,
  DeckResponse,
} from "@openrift/shared/types/api/deck";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import {
  createCollection,
  eq,
  localOnlyCollectionOptions,
  useLiveSuspenseQuery,
} from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { v7 as uuidv7 } from "uuid";

import { startSyncIfNeeded } from "@/features/collections/lib/collection-cleanup";
import {
  useDeckCardsCollection,
  useDecksCollection,
} from "@/features/decks/hooks/use-decks-collections";
import { useIsLocalDeck, useLocalDeck } from "@/features/decks/hooks/use-local-decks";
import { toDeckCard } from "@/features/decks/lib/deck-card-rows";
import type { EncodeDeckCardInput } from "@/features/decks/lib/deck-encode-input";
import { getDeckCardsCollection, getDecksCollection } from "@/features/decks/lib/decks-collection";
import { publicDeckQueryOptions } from "@/features/decks/lib/decks-queries";
import { deckFoldersKeys, decksKeys } from "@/features/decks/lib/decks-query-keys";
import {
  deckCardKey,
  saveDeckCards as applyDeckCards,
  updateDeck,
} from "@/features/decks/lib/decks-write";
import type { LocalDeck } from "@/features/decks/lib/local-deck";
import { updateLocalDeck } from "@/features/decks/lib/local-decks-collection";
import { useRequiredUserId, useUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

export function useDecks(): { data: DeckListItemResponse[] } {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  const collection = getDecksCollection(queryClient, userId);
  const { data } = useLiveSuspenseQuery({ query: (q) => q.from({ deck: collection }) });
  return { data };
}

async function loadedDecks(queryClient: QueryClient, userId: string) {
  const collection = getDecksCollection(queryClient, userId);
  await collection.preload();
  return collection;
}

function newDeckRow(input: {
  id?: string;
  name: string;
  description?: string | null;
  format: DeckFormat;
  links?: DeckLink[];
}): DeckListItemResponse {
  const now = new Date().toISOString();
  return {
    deck: {
      id: input.id ?? uuidv7(),
      name: input.name,
      descriptionSnippet: descriptionSnippet(input.description ?? null),
      description: input.description ?? null,
      links: input.links ?? [],
      oddsConfig: null,
      isPublic: false,
      shareToken: null,
      format: input.format,
      formatConfig: null,
      isPinned: false,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      coverCardId: null,
      coverPrintingId: null,
      coverPosition: null,
      collectionId: null,
      familyId: null,
      predecessorDeckId: null,
      isPrimary: false,
      isDraft: false,
    },
    legendCardId: null,
    championCardId: null,
    totalCards: 0,
    typeCounts: [],
    domainDistribution: [],
    isValid: false,
    requiredProgress: 0,
    requiredTotal: 0,
    totalValueCents: null,
    missingCount: null,
    folderIds: [],
  };
}

/**
 * Synthesizes a deck-detail response for a browser-local deck. Owner-only
 * fields (isPublic / shareToken / isPinned / archivedAt) are constants because
 * a local deck has no server-side state.
 */
function localDeckDetail(
  deckId: string,
  deck: LocalDeck | undefined,
): { data: DeckDetailResponse } {
  const data: DeckDetailResponse = {
    deck: {
      id: deckId,
      name: deck?.name ?? "Deck",
      description: deck?.description ?? null,
      format: deck?.format ?? WellKnown.deckFormat.CONSTRUCTED,
      formatConfig: deck?.formatConfig ?? null,
      isPublic: false,
      shareToken: null,
      isPinned: false,
      archivedAt: null,
      oddsConfig: null,
      coverCardId: deck?.coverCardId ?? null,
      coverPrintingId: deck?.coverPrintingId ?? null,
      coverPosition: deck?.coverPosition ?? null,
      links: deck?.links ?? [],
      collectionId: null,
      familyId: null,
      predecessorDeckId: null,
      isPrimary: false,
      isDraft: false,
      createdAt: deck?.createdAt ?? "",
      updatedAt: deck?.updatedAt ?? "",
    },
    cards: deck?.cards ?? [],
  };
  return { data };
}

// Stand-ins so the live queries below run unconditionally for a signed-out visitor.
const noDecks = createCollection(
  localOnlyCollectionOptions<DeckListItemResponse>({
    id: "decks:none",
    getKey: (row) => row.deck.id,
  }),
);
const noDeckCards = createCollection(
  localOnlyCollectionOptions<DeckCardWithDeckResponse>({
    id: "deck-cards:none",
    getKey: (row) => deckCardKey(row),
  }),
);

export function useDeckDetail(deckId: string): { data: DeckDetailResponse } {
  const localDeck = useLocalDeck(deckId);
  const decksCollection = useDecksCollection();
  const cardsCollection = useDeckCardsCollection();
  // A browser-local deck reads nothing from the server stores, so it must not start their sync.
  const decks = localDeck === undefined ? (decksCollection ?? noDecks) : noDecks;
  const cards = localDeck === undefined ? (cardsCollection ?? noDeckCards) : noDeckCards;
  const { data: stored } = useLiveSuspenseQuery({
    query: (q) =>
      q
        .from({ row: decks })
        .where(({ row }) => eq(row.deck.id, deckId))
        .findOne(),
  });
  const { data: cardRows } = useLiveSuspenseQuery({
    query: (q) => q.from({ card: cards }).where(({ card }) => eq(card.deckId, deckId)),
  });

  if (!stored) {
    return localDeckDetail(deckId, localDeck);
  }
  const { descriptionSnippet: _snippet, ...deck } = stored.deck;
  return {
    data: {
      deck,
      cards: cardRows.map((row) => toDeckCard(row)),
    },
  };
}

export function useCreateDeck() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      id?: string;
      name: string;
      description?: string | null;
      format: DeckFormat;
      links?: DeckLink[];
    }): Promise<DeckListItemResponse["deck"]> => {
      if (!userId) {
        throw new Error("Cannot create a deck while signed out");
      }
      const collection = await loadedDecks(queryClient, userId);
      const row = newDeckRow(body);
      // A claim retried after its cards failed already holds the row, and inserting it again throws.
      const existing = collection.get(row.deck.id);
      if (existing) {
        return existing.deck;
      }
      await collection.insert(row).isPersisted.promise;
      return collection.get(row.deck.id)?.deck ?? row.deck;
    },
  });
}

export function useDeleteDeck() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      if (!userId) {
        return;
      }
      const collection = await loadedDecks(queryClient, userId);
      if (!collection.has(deckId)) {
        return;
      }
      await collection.delete(deckId).isPersisted.promise;
      // The deck-cards delta keys on live decks, so a deleted deck's rows never leave on their own.
      const cards = getDeckCardsCollection(queryClient, userId);
      const keys = cards.toArray
        .filter((row) => row.deckId === deckId)
        .map((row) => deckCardKey(row));
      if (keys.length > 0) {
        startSyncIfNeeded(cards);
        cards.utils.writeDelete(keys);
      }
    },
  });
}

export function useSaveDeckCards() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deckId,
      cards,
    }: {
      deckId: string;
      cards: {
        cardId: string;
        zone: DeckZone;
        quantity: number;
        preferredPrintingId: string | null;
      }[];
    }): Promise<void> => {
      if (!userId) {
        return;
      }
      const collection = getDeckCardsCollection(queryClient, userId);
      await collection.preload();
      await applyDeckCards(collection, deckId, cards, { queryClient, userId }).isPersisted.promise;
    },
  });
}

export function useUpdateDeck() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deckId,
      ...fields
    }: {
      deckId: string;
      name?: string;
      description?: string | null;
      format?: DeckFormat;
      formatConfig?: DeckFormatConfig | null;
      oddsConfig?: DeckOddsConfig | null;
      coverCardId?: string | null;
      coverPrintingId?: string | null;
      coverPosition?: number | null;
      links?: DeckLink[];
      collectionId?: string | null;
      isDraft?: boolean;
    }) => {
      if (!userId) {
        return;
      }
      const collection = await loadedDecks(queryClient, userId);
      if (!collection.has(deckId)) {
        return;
      }
      await updateDeck(collection, deckId, fields).isPersisted.promise;
    },
  });
}

/** Metadata patch shared by rename / description / change-format / cover surfaces. */
export interface DeckMetaPatch {
  name?: string;
  description?: string | null;
  format?: DeckFormat;
  formatConfig?: DeckFormatConfig | null;
  coverCardId?: string | null;
  coverPrintingId?: string | null;
  coverPosition?: number | null;
  links?: DeckLink[];
}

export function useUpdateDeckMeta(deckId: string): {
  update: (patch: DeckMetaPatch, opts?: { onSuccess?: () => void }) => void;
  isPending: boolean;
} {
  const serverUpdate = useUpdateDeck();
  const isLocal = useIsLocalDeck(deckId);
  return {
    update: (patch, opts) => {
      if (isLocal) {
        updateLocalDeck(deckId, patch);
        opts?.onSuccess?.();
        return;
      }
      serverUpdate.mutate({ deckId, ...patch }, opts);
    },
    isPending: isLocal ? false : serverUpdate.isPending,
  };
}

export function useSetDeckPinned() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deckId, isPinned }: { deckId: string; isPinned: boolean }) => {
      const collection = await loadedDecks(queryClient, userId);
      if (!collection.has(deckId)) {
        return;
      }
      await collection.update(deckId, (draft) => {
        draft.deck = { ...draft.deck, isPinned };
      }).isPersisted.promise;
    },
  });
}

export function useSetDeckArchived() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deckId, archived }: { deckId: string; archived: boolean }) => {
      const collection = await loadedDecks(queryClient, userId);
      if (!collection.has(deckId)) {
        return;
      }
      await collection.update(deckId, (draft) => {
        draft.deck = { ...draft.deck, archivedAt: archived ? new Date().toISOString() : null };
      }).isPersisted.promise;
    },
  });
}

const createDeckVariantFn = createServerFn({ method: "POST" })
  .validator((input: { deckId: string; name?: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckResponse> =>
    apiOrpcClient(decksContract, context.cookie).createVariant({
      id: data.deckId,
      ...(data.name ? { name: data.name } : {}),
    }),
  );

/** The variant joins the source's folders, so the folder counts move too. */
export function useCreateDeckVariant() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { deckId: string; name?: string }): Promise<DeckResponse> => {
      const created = await createDeckVariantFn({ data: input });
      // Awaited: the caller navigates to the variant, whose route reads it from the store.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: decksKeys.syncedStore(userId) }),
        queryClient.invalidateQueries({ queryKey: deckFoldersKeys.all(userId) }),
      ]);
      return created;
    },
  });
}

const linkDeckVariantFn = createServerFn({ method: "POST" })
  .validator(
    (input: { deckId: string; otherDeckId: string; markAsPreviousVersion?: boolean }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckResponse> =>
    apiOrpcClient(decksContract, context.cookie).linkVariant({
      id: data.deckId,
      otherDeckId: data.otherDeckId,
      ...(data.markAsPreviousVersion ? { markAsPreviousVersion: true } : {}),
    }),
  );

export function useLinkDeckVariant() {
  const userId = useRequiredUserId();
  // Linking rewrites the family and primary of every member on both sides.
  return useMutationWithInvalidation<
    DeckResponse,
    { deckId: string; otherDeckId: string; markAsPreviousVersion?: boolean }
  >({
    mutationFn: (input) => linkDeckVariantFn({ data: input }),
    invalidates: [decksKeys.syncedStore(userId)],
  });
}

const unlinkDeckVariantFn = createServerFn({ method: "POST" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: deckId }): Promise<DeckResponse> =>
    apiOrpcClient(decksContract, context.cookie).unlinkVariant({ id: deckId }),
  );

export function useUnlinkDeckVariant() {
  const userId = useRequiredUserId();
  // Leaving a family can promote a survivor and splice the predecessor chain.
  return useMutationWithInvalidation<DeckResponse, string>({
    mutationFn: (deckId) => unlinkDeckVariantFn({ data: deckId }),
    invalidates: [decksKeys.syncedStore(userId)],
  });
}

export function useSetDeckPredecessor() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      deckId,
      predecessorDeckId,
    }: {
      deckId: string;
      predecessorDeckId: string | null;
    }) => {
      const collection = await loadedDecks(queryClient, userId);
      if (!collection.has(deckId)) {
        return;
      }
      await collection.update(deckId, (draft) => {
        draft.deck = { ...draft.deck, predecessorDeckId };
      }).isPersisted.promise;
      // The rail and lineage list read every member's pointer, not just this row's.
      void queryClient.invalidateQueries({ queryKey: decksKeys.syncedStore(userId) });
    },
  });
}

export function usePromoteDeckPrimary() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      const collection = await loadedDecks(queryClient, userId);
      if (!collection.has(deckId)) {
        return;
      }
      await collection.update(deckId, (draft) => {
        draft.deck = { ...draft.deck, isPrimary: true };
      }).isPersisted.promise;
    },
  });
}

type ExportFormat = "piltover" | "text" | "tts";

const exportDeckFn = createServerFn({ method: "GET" })
  .validator((input: { deckId: string; format?: ExportFormat }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckExportResponse> =>
    apiOrpcClient(decksContract, context.cookie).export({
      id: data.deckId,
      // Omitting format lets the contract apply its `piltover` default.
      ...(data.format ? { format: data.format } : {}),
    }),
  );

export function useExportDeck() {
  return useMutationWithInvalidation<DeckExportResponse, { deckId: string; format?: ExportFormat }>(
    {
      mutationFn: ({ deckId, format }) => exportDeckFn({ data: { deckId, format } }),
      invalidates: [],
    },
  );
}

// Public (no-cookie) encoder for browser-local decks, which have no server row to `export` by id.
const encodeDeckCardsFn = createServerFn({ method: "POST" })
  .validator((input: { format?: ExportFormat; cards: EncodeDeckCardInput[] }) => input)
  .handler(({ data }): Promise<DeckExportResponse> =>
    apiOrpcClient(publicDecksContract).encode(data),
  );

export function useEncodeDeckCards() {
  return useMutationWithInvalidation<
    DeckExportResponse,
    { format?: ExportFormat; cards: EncodeDeckCardInput[] }
  >({
    mutationFn: (input) => encodeDeckCardsFn({ data: input }),
    invalidates: [],
  });
}

function useSetDeckPublic(isPublic: boolean) {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      const collection = await loadedDecks(queryClient, userId);
      if (!collection.has(deckId)) {
        return;
      }
      await collection.update(deckId, (draft) => {
        draft.deck = { ...draft.deck, isPublic };
      }).isPersisted.promise;
    },
  });
}

export function useShareDeck() {
  return useSetDeckPublic(true);
}

export function useUnshareDeck() {
  return useSetDeckPublic(false);
}

export function usePublicDeck(token: string) {
  return useSuspenseQuery(publicDeckQueryOptions(token));
}

export interface CloneSharedDeckInput {
  token: string;
  name?: string;
  description?: string;
}

const cloneSharedDeckFn = createServerFn({ method: "POST" })
  .validator((input: CloneSharedDeckInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DeckCloneResponse> =>
    apiOrpcClient(decksContract, context.cookie).cloneShared(data),
  );

export function useCloneSharedDeck() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloneSharedDeckInput): Promise<DeckCloneResponse> => {
      const cloned = await cloneSharedDeckFn({ data: input });
      // A clone lands a new deck and its cards; awaited because the caller navigates to it.
      if (userId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: decksKeys.syncedStore(userId) }),
          queryClient.invalidateQueries({ queryKey: decksKeys.cardsStore(userId) }),
        ]);
      }
      return cloned;
    },
  });
}
