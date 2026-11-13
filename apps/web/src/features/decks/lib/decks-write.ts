import { deckFoldersContract } from "@openrift/shared/contracts/deck-folders";
import { decksContract } from "@openrift/shared/contracts/decks";
import { EMPTY_DECK_LIST_SUMMARY } from "@openrift/shared/deck-list-summary";
import { descriptionSnippet } from "@openrift/shared/description-snippet";
import type {
  DeckCardWithDeckResponse,
  DeckFolderResponse,
  DeckListItemResponse,
  DeckResponse,
} from "@openrift/shared/types/api/deck";
import { isDefinedError, safe } from "@orpc/client";
import type { Collection, PendingMutation, Transaction } from "@tanstack/react-db";
import { createTransaction } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";

import { startSyncIfNeeded } from "@/features/collections/lib/collection-cleanup";
import { writeSkippingMissing } from "@/features/collections/lib/copies-write";
import { deckCardKey } from "@/features/decks/lib/deck-builder-card";
import { deckFoldersKeys, decksKeys } from "@/features/decks/lib/decks-query-keys";
import { mutationTag } from "@/lib/mutation-metadata";
import { watchForRefetchRace } from "@/lib/refetch-race";
import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";

export type DecksCollection = Collection<DeckListItemResponse, string | number>;
export type DeckCardsCollection = Collection<DeckCardWithDeckResponse, string | number>;
export type DeckFoldersCollection = Collection<DeckFolderResponse, string | number>;

export interface DecksWriteContext {
  queryClient: QueryClient;
  userId: string;
}

export function deckCardRowKey(row: {
  deckId: string;
  cardId: string;
  zone: string;
  preferredPrintingId: string | null;
}): string {
  return `${row.deckId}|${deckCardKey(row)}`;
}

const reorders = mutationTag<readonly string[]>();
const deckPatches = mutationTag<Record<string, unknown>>();

export type DeckBulkChange =
  | { kind: "archive"; archived: boolean }
  | { kind: "addToFolder"; folderId: string }
  | { kind: "removeFromFolder"; folderId: string };

const bulkChanges = mutationTag<DeckBulkChange>();

function needsBulkChange(row: DeckListItemResponse, change: DeckBulkChange): boolean {
  if (change.kind === "archive") {
    return (row.deck.archivedAt !== null) !== change.archived;
  }
  const filed = row.folderIds.includes(change.folderId);
  return change.kind === "addToFolder" ? !filed : filed;
}

/** The decks among `deckIds` the change would alter; the rest are already in that state or not in the store. */
export function decksNeedingChange(
  collection: DecksCollection,
  deckIds: readonly string[],
  change: DeckBulkChange,
): string[] {
  return deckIds.filter((id) => {
    const row = collection.get(id);
    return row !== undefined && needsBulkChange(row, change);
  });
}

/** One transaction, which the write path sends as one bulk call. Undefined when no deck needs the change. */
export function bulkUpdateDecks(
  collection: DecksCollection,
  deckIds: readonly string[],
  change: DeckBulkChange,
): Transaction | undefined {
  const ids = decksNeedingChange(collection, deckIds, change);
  if (ids.length === 0) {
    return undefined;
  }
  const archivedAt = new Date().toISOString();
  return collection.update(ids, { metadata: bulkChanges.tag(change) }, (drafts) => {
    for (const draft of drafts) {
      if (change.kind === "archive") {
        draft.deck = { ...draft.deck, archivedAt: change.archived ? archivedAt : null };
      } else if (change.kind === "addToFolder") {
        draft.folderIds = [...draft.folderIds, change.folderId];
      } else {
        draft.folderIds = draft.folderIds.filter((id) => id !== change.folderId);
      }
    }
  });
}

function bulkChangeOf(mutation: PendingMutation<DeckListItemResponse>): DeckBulkChange | undefined {
  return bulkChanges.read(mutation.metadata);
}

function summaryFieldsOf(patch: Record<string, unknown>): Partial<DeckListItemResponse["deck"]> {
  const fields: Record<string, unknown> = {};
  for (const field of PATCH_FIELDS) {
    if (field in patch) {
      fields[field] = patch[field];
    }
  }
  if ("description" in patch) {
    fields.descriptionSnippet = descriptionSnippet(patch.description as string | null);
  }
  return fields as Partial<DeckListItemResponse["deck"]>;
}

export function updateDeck(
  collection: DecksCollection,
  deckId: string,
  patch: Record<string, unknown>,
): Transaction {
  return collection.update(deckId, { metadata: deckPatches.tag(patch) }, (draft) => {
    draft.deck = { ...draft.deck, ...summaryFieldsOf(patch) };
  });
}

function patchOf(
  mutation: PendingMutation<DeckListItemResponse>,
): Record<string, unknown> | undefined {
  return deckPatches.read(mutation.metadata);
}

/** Folders missing from `orderedIds` keep their place, as the API's reorder does. */
export function reorderDeckFolders(
  collection: DeckFoldersCollection,
  orderedIds: readonly string[],
): Transaction {
  const present = orderedIds.filter((id) => collection.has(id));
  return collection.update(present, { metadata: reorders.tag(orderedIds) }, (drafts) => {
    for (const [index, draft] of drafts.entries()) {
      draft.sortOrder = index;
    }
  });
}

function reorderOf(mutation: PendingMutation<DeckFolderResponse>): readonly string[] | undefined {
  return reorders.read(mutation.metadata);
}

function listItemFor(deck: DeckResponse): DeckListItemResponse {
  return {
    deck: {
      id: deck.id,
      name: deck.name,
      descriptionSnippet: descriptionSnippet(deck.description),
      description: deck.description,
      links: deck.links,
      oddsConfig: deck.oddsConfig,
      isPublic: deck.isPublic,
      shareToken: deck.shareToken,
      format: deck.format,
      formatConfig: deck.formatConfig,
      isPinned: deck.isPinned,
      archivedAt: deck.archivedAt,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      coverCardId: deck.coverCardId,
      coverFaceId: deck.coverFaceId,
      coverPosition: deck.coverPosition,
      collectionId: deck.collectionId,
      familyId: deck.familyId,
      predecessorDeckId: deck.predecessorDeckId,
      isPrimary: deck.isPrimary,
      isDraft: deck.isDraft,
    },
    ...EMPTY_DECK_LIST_SUMMARY,
  };
}

// Upsert, not update: during a create the row `get` returns is the optimistic
// one, which synced state does not hold yet, and an update of it would throw.
async function mergeDeck(collection: DecksCollection, deck: DeckResponse): Promise<void> {
  const row = collection.get(deck.id);
  const listItem = listItemFor(deck);
  await collection.utils.writeUpsert(
    row ? { ...row, deck: { ...row.deck, ...listItem.deck } } : listItem,
  );
}

async function persistBulkChange(
  collection: DecksCollection,
  change: DeckBulkChange,
  mutations: readonly PendingMutation<DeckListItemResponse>[],
  context: DecksWriteContext,
): Promise<void> {
  const ids = mutations.map((mutation) => String(mutation.key));
  if (change.kind === "archive") {
    const { items } = await browserApiOrpcClient(decksContract).setArchivedMany({
      ids,
      archived: change.archived,
    });
    const rows = items.flatMap((deck) => {
      const row = collection.get(deck.id);
      return row ? [{ ...row, deck: { ...row.deck, ...listItemFor(deck).deck } }] : [];
    });
    if (rows.length > 0) {
      await collection.utils.writeUpsert(rows);
    }
    return;
  }
  const client = browserApiOrpcClient(deckFoldersContract);
  const input = { folderId: change.folderId, deckIds: ids };
  await (change.kind === "addToFolder" ? client.addDecks(input) : client.removeDecks(input));
  await collection.utils.writeUpdate(mutations.map((mutation) => mutation.modified));
  void context.queryClient.invalidateQueries({ queryKey: deckFoldersKeys.all(context.userId) });
}

const PATCH_FIELDS = [
  "name",
  "description",
  "links",
  "oddsConfig",
  "format",
  "formatConfig",
  "coverCardId",
  "coverFaceId",
  "coverPosition",
  "collectionId",
  "isDraft",
] as const;

function patchFor(
  original: DeckListItemResponse["deck"],
  modified: DeckListItemResponse["deck"],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of PATCH_FIELDS) {
    if (field in modified && modified[field] !== original[field]) {
      patch[field] = modified[field];
    }
  }
  return patch;
}

async function persistDeckUpdate(
  collection: DecksCollection,
  id: string,
  row: {
    original: DeckListItemResponse;
    updated: DeckListItemResponse;
    patch?: Record<string, unknown>;
  },
  context: DecksWriteContext,
): Promise<void> {
  const client = browserApiOrpcClient(decksContract);
  const original = row.original.deck;
  const modified = row.updated.deck;

  const patch = row.patch ?? patchFor(original, modified);
  if (Object.keys(patch).length > 0) {
    await mergeDeck(collection, await client.update({ id, ...patch }));
  }
  if (modified.isPinned !== original.isPinned) {
    await mergeDeck(collection, await client.setPinned({ id, isPinned: modified.isPinned }));
  }
  if (modified.archivedAt !== original.archivedAt) {
    await mergeDeck(
      collection,
      await client.setArchived({ id, archived: modified.archivedAt !== null }),
    );
  }
  if (modified.isPublic !== original.isPublic) {
    const share = modified.isPublic
      ? await client.share({ id })
      : { isPublic: false, shareToken: null };
    if (!modified.isPublic) {
      await client.unshare({ id });
    }
    await collection.utils.writeUpdate({
      ...row.updated,
      deck: { ...modified, isPublic: share.isPublic, shareToken: share.shareToken },
    });
  }
  if (modified.predecessorDeckId !== original.predecessorDeckId) {
    await mergeDeck(
      collection,
      await client.setPredecessor({ id, predecessorDeckId: modified.predecessorDeckId }),
    );
  }
  if (modified.isPrimary && !original.isPrimary) {
    await mergeDeck(collection, await client.promotePrimary({ id }));
    // Promotion reorders the family, so rows other than this one change too.
    void context.queryClient.invalidateQueries({
      queryKey: decksKeys.syncedStore(context.userId),
    });
  }

  const folderIds = row.updated.folderIds;
  if (folderIds !== row.original.folderIds) {
    await browserApiOrpcClient(deckFoldersContract).setForDeck({ id, folderIds });
    await collection.utils.writeUpdate({ ...row.updated, folderIds });
    void context.queryClient.invalidateQueries({ queryKey: deckFoldersKeys.all(context.userId) });
  }
}

/** Sends a transaction's deck writes to the API, writing each confirmed change into the synced store. */
export async function persistDeckMutations(
  collection: DecksCollection,
  mutations: readonly PendingMutation<DeckListItemResponse>[],
  context: DecksWriteContext,
): Promise<void> {
  startSyncIfNeeded(collection);
  const settleRefetchRace = watchForRefetchRace(
    context.queryClient,
    decksKeys.syncedStore(context.userId),
  );
  try {
    const client = browserApiOrpcClient(decksContract);
    const bulkGroups = new Map<DeckBulkChange, PendingMutation<DeckListItemResponse>[]>();
    for (const mutation of mutations) {
      const id = String(mutation.key);
      const change = bulkChangeOf(mutation);
      if (change) {
        bulkGroups.set(change, [...(bulkGroups.get(change) ?? []), mutation]);
      } else if (mutation.type === "insert") {
        const { deck } = mutation.modified;
        const created = await client.create({
          id,
          name: deck.name,
          description: deck.description,
          links: deck.links,
          format: deck.format,
          ...(deck.formatConfig === null ? {} : { formatConfig: deck.formatConfig }),
        });
        await mergeDeck(collection, created);
      } else if (mutation.type === "delete") {
        // A deck already gone on the server still has to leave the store, or the
        // optimistic delete rolls back and the row returns.
        const { error } = await safe(client.remove({ id }));
        if (error && !(isDefinedError(error) && error.code === "NOT_FOUND")) {
          throw error;
        }
        await collection.utils.writeDelete([id]);
      } else if ("deck" in mutation.original) {
        await persistDeckUpdate(
          collection,
          id,
          { original: mutation.original, updated: mutation.modified, patch: patchOf(mutation) },
          context,
        );
      }
    }
    for (const [change, group] of bulkGroups) {
      await persistBulkChange(collection, change, group, context);
    }
  } catch (error) {
    settleRefetchRace();
    throw error;
  }
  settleRefetchRace();
}

// A direct mutation commits before the collection recomputes its optimistic state,
// so the transaction's own rows are the newer value.
function rowsOfDeck(
  collection: DeckCardsCollection,
  mutations: readonly PendingMutation<DeckCardWithDeckResponse>[],
  deckId: string,
): DeckCardWithDeckResponse[] {
  const rows = new Map<string, DeckCardWithDeckResponse>();
  for (const row of collection.toArray) {
    if (row.deckId === deckId) {
      rows.set(deckCardRowKey(row), row);
    }
  }
  for (const mutation of mutations) {
    if (mutation.modified.deckId !== deckId) {
      continue;
    }
    if ("deckId" in mutation.original) {
      rows.delete(deckCardRowKey(mutation.original));
    }
    if (mutation.type !== "delete") {
      rows.set(deckCardRowKey(mutation.modified), mutation.modified);
    }
  }
  return [...rows.values()];
}

function goneKeys(
  rows: readonly DeckCardWithDeckResponse[],
  mutations: readonly PendingMutation<DeckCardWithDeckResponse>[],
  deckId: string,
  storedKeys: ReadonlySet<string>,
): string[] {
  const keys = new Set(rows.map((row) => deckCardRowKey(row)));
  for (const mutation of mutations) {
    if ("deckId" in mutation.original && mutation.original.deckId === deckId) {
      keys.add(deckCardRowKey(mutation.original));
    }
  }
  return [...keys].filter((key) => !storedKeys.has(key));
}

/** One replace per deck: the API stores a deck's cards as a whole list. */
export async function persistDeckCardMutations(
  collection: DeckCardsCollection,
  mutations: readonly PendingMutation<DeckCardWithDeckResponse>[],
  context: DecksWriteContext,
): Promise<void> {
  startSyncIfNeeded(collection);
  const settleRefetchRace = watchForRefetchRace(
    context.queryClient,
    decksKeys.cardsStore(context.userId),
  );
  const deckIds = [...new Set(mutations.map((mutation) => mutation.modified.deckId))];
  try {
    for (const deckId of deckIds) {
      const rows = rowsOfDeck(collection, mutations, deckId);
      const { cards } = await browserApiOrpcClient(decksContract).replaceCards({
        id: deckId,
        cards: rows.map((row) => ({
          cardId: row.cardId,
          zone: row.zone,
          quantity: row.quantity,
          preferredPrintingId: row.preferredPrintingId,
        })),
      });
      const stored = cards.map((card) => ({ deckId, ...card }));
      const storedKeys = new Set(stored.map((card) => deckCardRowKey(card)));
      const gone = goneKeys(rows, mutations, deckId, storedKeys);
      await collection.utils.writeUpsert(stored);
      if (gone.length > 0) {
        await writeSkippingMissing(gone, (keys) => collection.utils.writeDelete(keys));
      }
      // The deck's card counts, validity and value live on its list row.
      void context.queryClient.invalidateQueries({
        queryKey: decksKeys.syncedStore(context.userId),
      });
    }
  } catch (error) {
    settleRefetchRace();
    throw error;
  }
  settleRefetchRace();
}

/** Applies a deck's whole card list to the store; the write path turns it into one replace call. */
export function saveDeckCards(
  collection: DeckCardsCollection,
  deckId: string,
  cards: readonly {
    cardId: string;
    zone: DeckCardWithDeckResponse["zone"];
    quantity: number;
    preferredPrintingId: string | null;
  }[],
  context: DecksWriteContext,
): Transaction<DeckCardWithDeckResponse> {
  const incoming = new Map(cards.map((card) => [deckCardRowKey({ deckId, ...card }), card]));
  const existing = collection.toArray.filter((row) => row.deckId === deckId);
  const transaction = createTransaction<DeckCardWithDeckResponse>({
    mutationFn: ({ transaction: batch }) =>
      persistDeckCardMutations(collection, batch.mutations, context),
  });
  transaction.mutate(() => {
    for (const row of existing) {
      const key = deckCardRowKey(row);
      const card = incoming.get(key);
      if (!card) {
        collection.delete(key);
        continue;
      }
      if (card.quantity !== row.quantity) {
        collection.update(key, (draft) => {
          draft.quantity = card.quantity;
        });
      }
      incoming.delete(key);
    }
    for (const card of incoming.values()) {
      collection.insert({ deckId, ...card });
    }
  });
  return transaction;
}

/** Sends a transaction's folder writes to the API; the adapter's refetch brings the confirmed rows back. */
export async function persistDeckFolderMutations(
  mutations: readonly PendingMutation<DeckFolderResponse>[],
  context: DecksWriteContext,
): Promise<void> {
  const client = browserApiOrpcClient(deckFoldersContract);
  const reorderGroups = new Set<readonly string[]>();
  for (const mutation of mutations) {
    const orderedIds = reorderOf(mutation);
    if (orderedIds) {
      reorderGroups.add(orderedIds);
      continue;
    }
    const id = String(mutation.key);
    if (mutation.type === "insert") {
      await client.create({ id, name: mutation.modified.name });
    } else if (mutation.type === "update") {
      await client.update({ id, name: mutation.modified.name });
    } else {
      await client.remove({ id });
      // A removed folder drops its chip from every deck row.
      void context.queryClient.invalidateQueries({
        queryKey: decksKeys.syncedStore(context.userId),
      });
    }
  }
  for (const orderedIds of reorderGroups) {
    await client.reorder({ orderedIds: [...orderedIds] });
  }
}
