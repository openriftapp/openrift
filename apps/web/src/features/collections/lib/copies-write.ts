import {
  copiesContract,
  MAX_COPIES_PER_ADD,
  MAX_COPIES_PER_REQUEST,
} from "@openrift/shared/contracts/copies";
import {
  definedCopyMetadataFields,
  normalizeCopyMetadataPatch,
} from "@openrift/shared/copy-metadata";
import type {
  CollectionResponse,
  CopyMetadataPatch,
  CopyResponse,
} from "@openrift/shared/types/api/collection";
import type { Collection, PendingMutation, Transaction } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";

import { startSyncIfNeeded } from "@/features/collections/lib/collection-cleanup";
import { collectionsKeys, copiesKeys } from "@/features/collections/lib/collections-query-keys";
import { watchForRefetchRace } from "@/lib/refetch-race";
import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";
import { withTimeout } from "@/lib/with-timeout";
import { m } from "@/paraglide/messages.js";

export type CopiesCollection = Collection<CopyResponse, string | number>;

export interface CopiesWriteContext {
  queryClient: QueryClient;
  userId: string;
}

interface PendingInsert {
  settled: Promise<unknown>;
  confirmed: boolean;
}

const pendingInsertsByCollection = new WeakMap<CopiesCollection, Map<string, PendingInsert>>();
const metadataPatches = new WeakMap<object, CopyMetadataPatch>();

function pendingInsertsOf(collection: CopiesCollection): Map<string, PendingInsert> {
  const existing = pendingInsertsByCollection.get(collection);
  if (existing) {
    return existing;
  }
  const pending = new Map<string, PendingInsert>();
  pendingInsertsByCollection.set(collection, pending);
  return pending;
}

export function groupIdForCollection(
  queryClient: QueryClient,
  userId: string,
  collectionId: string,
): string | null {
  const cached = queryClient.getQueryData<CollectionResponse[]>(
    collectionsKeys.syncedStore(userId),
  );
  return cached?.find((col) => col.id === collectionId)?.groupId ?? null;
}

/** Resolves with the add's failure, or null once it is stored. */
async function failureOf(transaction: {
  isPersisted: { promise: Promise<unknown> };
}): Promise<unknown> {
  try {
    await transaction.isPersisted.promise;
    return null;
  } catch (error) {
    return error ?? new Error("Copy add failed");
  }
}

async function forgetWhenSettled(
  pending: Map<string, PendingInsert>,
  id: string,
  entry: PendingInsert,
): Promise<void> {
  await entry.settled;
  if (pending.get(id) === entry) {
    pending.delete(id);
  }
}

/** Lets a move, edit or removal of these ids wait for the add that creates them. */
export function trackPendingInserts(
  collection: CopiesCollection,
  ids: readonly string[],
  transaction: { isPersisted: { promise: Promise<unknown> } },
): void {
  const pending = pendingInsertsOf(collection);
  const settled = failureOf(transaction);
  for (const id of ids) {
    const entry = { settled, confirmed: false };
    pending.set(id, entry);
    void forgetWhenSettled(pending, id, entry);
  }
}

// The optimistic row hides the stored one until the whole transaction settles.
export async function waitForInsert(
  collection: CopiesCollection,
  row: CopyResponse,
): Promise<CopyResponse> {
  const entry = pendingInsertsOf(collection).get(row.id);
  if (entry) {
    const failure = await entry.settled;
    if (!entry.confirmed) {
      throw failure instanceof Error ? failure : new Error(String(failure));
    }
  }
  return collection.get(row.id) ?? row;
}

/** Sends the whole normalized patch with each mutation, so grader and grade reach the API together. */
export function updateCopyMetadata(
  collection: CopiesCollection,
  copyIds: string[],
  patch: CopyMetadataPatch,
): Transaction {
  const applied = definedCopyMetadataFields(normalizeCopyMetadataPatch(patch));
  const metadata = {};
  metadataPatches.set(metadata, applied);
  return collection.update(copyIds, { metadata }, (drafts) => {
    for (const draft of drafts) {
      Object.assign(draft, applied);
    }
  });
}

// fetch throws a TypeError for offline/DNS/CORS failures; an abort throws
// DOMException("AbortError") instead and must propagate untouched.
function rethrowAsNetworkError(error: unknown): never {
  if (error instanceof TypeError) {
    // oxlint-disable-next-line unicorn/prefer-type-error -- this is a network failure, not a type check
    throw new Error(m.collections_copies_network_error());
  }
  throw error;
}

async function requestOrNetworkError<T>(
  request: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  try {
    return await request(signal);
  } catch (error) {
    return rethrowAsNetworkError(error);
  }
}

function send<T>(label: string, request: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  return withTimeout(requestOrNetworkError(request, controller.signal), {
    label,
    abortController: controller,
  });
}

async function inChunks<T>(
  items: readonly T[],
  size: number,
  sendChunk: (chunk: T[]) => Promise<void>,
): Promise<void> {
  for (let start = 0; start < items.length; start += size) {
    await sendChunk(items.slice(start, start + size));
  }
}

function isMissingRowError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "UpdateOperationItemNotFoundError" ||
      error.name === "DeleteOperationItemNotFoundError")
  );
}

// An earlier chunk's store write can flush a refetch that already removed a later chunk's row,
// and a batched write then refuses every row in it.
export function writeSkippingMissing<T>(items: readonly T[], write: (batch: T[]) => void): void {
  try {
    write([...items]);
  } catch (error) {
    if (!isMissingRowError(error)) {
      throw error;
    }
    for (const item of items) {
      try {
        write([item]);
      } catch (itemError) {
        if (!isMissingRowError(itemError)) {
          throw itemError;
        }
      }
    }
  }
}

function batchIdOf(mutation: PendingMutation<CopyResponse>): string | undefined {
  const { metadata } = mutation;
  return typeof metadata === "object" &&
    metadata !== null &&
    "batchId" in metadata &&
    typeof metadata.batchId === "string"
    ? metadata.batchId
    : undefined;
}

function addCopyInput(copy: CopyResponse) {
  return {
    id: copy.id,
    printingId: copy.printingId,
    collectionId: copy.collectionId,
    ...(copy.condition === null ? {} : { condition: copy.condition }),
    ...(copy.grader === null ? {} : { grader: copy.grader }),
    ...(copy.grade === null ? {} : { grade: copy.grade }),
    ...(copy.notesPublic === null ? {} : { notesPublic: copy.notesPublic }),
    ...(copy.notesPrivate === null ? {} : { notesPrivate: copy.notesPrivate }),
    ...(copy.isAltered ? { isAltered: true } : {}),
    ...(copy.links.length > 0 ? { links: copy.links } : {}),
  };
}

function metadataPatchOf(mutation: PendingMutation<CopyResponse>): CopyMetadataPatch {
  const { metadata } = mutation;
  const registered =
    typeof metadata === "object" && metadata !== null ? metadataPatches.get(metadata) : undefined;
  if (registered) {
    return registered;
  }
  const { condition, grader, grade, notesPublic, notesPrivate, isAltered, links } =
    mutation.changes;
  return definedCopyMetadataFields({
    condition,
    grader,
    grade,
    notesPublic,
    notesPrivate,
    isAltered,
    links,
  });
}

async function persistInserts(
  collection: CopiesCollection,
  mutations: readonly PendingMutation<CopyResponse>[],
  context: CopiesWriteContext,
): Promise<void> {
  const batchIds = new Set(mutations.map((mutation) => batchIdOf(mutation)));
  const batchId = batchIds.size === 1 ? [...batchIds][0] : undefined;
  const pending = pendingInsertsOf(collection);
  try {
    await inChunks(mutations, MAX_COPIES_PER_ADD, async (chunk) => {
      const { items } = await send(m.collections_copies_timeout_add(), (signal) =>
        browserApiOrpcClient(copiesContract).add(
          { batchId, copies: chunk.map((mutation) => addCopyInput(mutation.modified)) },
          { signal },
        ),
      );
      collection.utils.writeUpsert(items);
      for (const item of items) {
        const entry = pending.get(item.id);
        if (entry) {
          entry.confirmed = true;
        }
      }
    });
  } catch (error) {
    // A lost response may still have created the rows, so resync.
    void context.queryClient.invalidateQueries({ queryKey: copiesKeys.all(context.userId) });
    throw error;
  }
}

async function persistUpdates(
  collection: CopiesCollection,
  mutations: readonly PendingMutation<CopyResponse>[],
  context: CopiesWriteContext,
): Promise<void> {
  const moves = new Map<string, string[]>();
  const patches = new Map<string, { patch: CopyMetadataPatch; copyIds: string[] }>();
  for (const mutation of mutations) {
    const copyId = String(mutation.key);
    const { collectionId } = mutation.changes;
    if (collectionId !== undefined) {
      const ids = moves.get(collectionId) ?? [];
      ids.push(copyId);
      moves.set(collectionId, ids);
    }
    const patch = metadataPatchOf(mutation);
    if (Object.keys(patch).length > 0) {
      const signature = JSON.stringify(patch);
      const group = patches.get(signature) ?? { patch, copyIds: [] };
      group.copyIds.push(copyId);
      patches.set(signature, group);
    }
  }

  for (const [toCollectionId, copyIds] of moves) {
    const groupId = groupIdForCollection(context.queryClient, context.userId, toCollectionId);
    await inChunks(copyIds, MAX_COPIES_PER_REQUEST, async (chunk) => {
      await send(m.collections_copies_timeout_move(), (signal) =>
        browserApiOrpcClient(copiesContract).move({ copyIds: chunk, toCollectionId }, { signal }),
      );
      writeSkippingMissing(
        chunk.map((id) => ({ id, collectionId: toCollectionId, groupId })),
        (rows) => collection.utils.writeUpdate(rows),
      );
    });
  }

  for (const { patch, copyIds } of patches.values()) {
    await inChunks(copyIds, MAX_COPIES_PER_REQUEST, async (chunk) => {
      await send(m.collections_copies_timeout_update(), (signal) =>
        browserApiOrpcClient(copiesContract).update({ copyIds: chunk, patch }, { signal }),
      );
      writeSkippingMissing(
        chunk.map((id) => ({ id, ...patch })),
        (rows) => collection.utils.writeUpdate(rows),
      );
    });
  }
}

async function persistDeletes(
  collection: CopiesCollection,
  copyIds: readonly string[],
): Promise<void> {
  await inChunks(copyIds, MAX_COPIES_PER_REQUEST, async (chunk) => {
    await send(m.collections_copies_timeout_dispose(), (signal) =>
      browserApiOrpcClient(copiesContract).dispose({ copyIds: chunk }, { signal }),
    );
    writeSkippingMissing(chunk, (ids) => collection.utils.writeDelete(ids));
  });
}

async function abandonedInsertKeys(
  collection: CopiesCollection,
  mutations: readonly PendingMutation<CopyResponse>[],
): Promise<Set<string>> {
  const pending = pendingInsertsOf(collection);
  const waiting = mutations.flatMap((mutation) => {
    const key = String(mutation.key);
    const entry = pending.get(key);
    return entry ? [{ key, entry }] : [];
  });
  const abandoned = new Set<string>();
  for (const { key, entry } of waiting) {
    await entry.settled;
    if (!entry.confirmed) {
      abandoned.add(key);
    }
  }
  return abandoned;
}

async function persistInOrder(
  collection: CopiesCollection,
  mutations: readonly PendingMutation<CopyResponse>[],
  context: CopiesWriteContext,
): Promise<void> {
  const inserts = mutations.filter((mutation) => mutation.type === "insert");
  const later = mutations.filter((mutation) => mutation.type !== "insert");
  const abandoned = abandonedInsertKeys(collection, later);

  if (inserts.length > 0) {
    await persistInserts(collection, inserts, context);
  }
  const skipped = await abandoned;
  const live = later.filter((mutation) => !skipped.has(String(mutation.key)));
  const updates = live.filter((mutation) => mutation.type === "update");
  const deletes = live
    .filter((mutation) => mutation.type === "delete")
    .map((mutation) => String(mutation.key));
  if (updates.length > 0) {
    await persistUpdates(collection, updates, context);
  }
  if (deletes.length > 0) {
    await persistDeletes(collection, deletes);
  }

  void context.queryClient.invalidateQueries({
    queryKey: copiesKeys.all(context.userId),
    refetchType: "none",
  });
  const changesTotals =
    inserts.length > 0 ||
    deletes.length > 0 ||
    updates.some((mutation) => mutation.changes.collectionId !== undefined);
  if (changesTotals) {
    void context.queryClient.invalidateQueries({ queryKey: collectionsKeys.all(context.userId) });
  }
}

/** Sends a transaction's copy writes to the bulk endpoints, writing each confirmed chunk into the synced store. */
export async function persistCopyMutations(
  collection: CopiesCollection,
  mutations: readonly PendingMutation<CopyResponse>[],
  context: CopiesWriteContext,
): Promise<void> {
  startSyncIfNeeded(collection);
  const settleRefetchRace = watchForRefetchRace(
    context.queryClient,
    copiesKeys.syncedStore(context.userId),
  );
  try {
    await persistInOrder(collection, mutations, context);
  } catch (error) {
    settleRefetchRace();
    throw error;
  }
  settleRefetchRace();
}
