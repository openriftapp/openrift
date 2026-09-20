import { copiesContract } from "@openrift/shared/contracts/copies";
import type {
  CopyListMembershipsResponse,
  CopyMetadataPatch,
  CopyResponse,
} from "@openrift/shared/types/api/collection";
import { createTransaction, eq, useLiveQuery } from "@tanstack/react-db";
import type { Transaction } from "@tanstack/react-db";
import { useBatcher } from "@tanstack/react-pacer";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { v7 as uuidv7 } from "uuid";

import { useCopiesCollection } from "@/features/collections/hooks/use-copies-collection";
import { copiesKeys } from "@/features/collections/lib/collections-query-keys";
import {
  groupIdForCollection,
  persistCopyMutations,
  trackPendingInserts,
  updateCopyMetadata,
  waitForInsert,
} from "@/features/collections/lib/copies-write";
import { trackEvent } from "@/lib/analytics";
import { useUserId } from "@/lib/auth-session";
import { reportMutationError } from "@/lib/query-client";
import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";
import { m } from "@/paraglide/messages.js";

export function useCopies(collectionId?: string): {
  data: CopyResponse[];
  isReady: boolean;
} {
  const copiesCollection = useCopiesCollection();

  const { data, isReady } = useLiveQuery({
    query: (q) => {
      if (!copiesCollection) {
        return null;
      }
      const base = q.from({ copy: copiesCollection });
      return collectionId === undefined
        ? base
        : base.where(({ copy }) => eq(copy.collectionId, collectionId));
    },
  });

  return { data: data ?? [], isReady };
}

/**
 * Which of the viewer's own lists reference `copyIds`. Backs the dispose
 * confirmation's cross-list warning. Ids are deduped and sorted for a stable
 * query key across selection order. Pass `excludeListId` to drop the
 * originating list from the result (the "Sold" action on a list page).
 */
export function useCopyListMemberships(
  copyIds: string[],
  enabled: boolean,
  excludeListId?: string,
) {
  const userId = useUserId();
  const stableIds = [...new Set(copyIds)].toSorted();
  return useQuery({
    queryKey: copiesKeys.listMemberships(userId ?? "", stableIds, excludeListId),
    queryFn: (): Promise<CopyListMembershipsResponse> =>
      browserApiOrpcClient(copiesContract).listMemberships({ copyIds: stableIds, excludeListId }),
    enabled: enabled && Boolean(userId) && stableIds.length > 0,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

interface AddCopyInput extends CopyMetadataPatch {
  id?: string;
  printingId: string;
  collectionId: string;
}

function optimisticCopy(
  queryClient: QueryClient,
  userId: string,
  input: AddCopyInput,
): CopyResponse {
  return {
    id: input.id ?? uuidv7(),
    printingId: input.printingId,
    collectionId: input.collectionId,
    groupId: groupIdForCollection(queryClient, userId, input.collectionId),
    condition: input.condition ?? null,
    grader: input.grader ?? null,
    grade: input.grade ?? null,
    notesPublic: input.notesPublic ?? null,
    notesPrivate: input.notesPrivate ?? null,
    isAltered: input.isAltered ?? false,
    links: input.links ?? [],
    onLoan: false,
    reserved: false,
  };
}

export function useAddCopies() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const copiesCollection = useCopiesCollection();

  return useMutation({
    // Default networkMode "online" pauses the mutation while offline with no feedback.
    networkMode: "always",
    mutationFn: async ({
      batchId,
      copies,
    }: {
      batchId?: string;
      copies: AddCopyInput[];
    }): Promise<CopyResponse[]> => {
      if (!userId || !copiesCollection) {
        throw new Error(m.collections_copies_signed_out());
      }
      const collection = copiesCollection;
      const rows = copies.map((input) => optimisticCopy(queryClient, userId, input));
      const fresh = rows.filter((row) => !collection.has(row.id));
      if (fresh.length > 0) {
        const transaction = collection.insert(
          fresh,
          batchId === undefined ? undefined : { metadata: { batchId } },
        );
        trackPendingInserts(
          collection,
          fresh.map((row) => row.id),
          transaction,
        );
      }
      const added = await Promise.all(rows.map((row) => waitForInsert(collection, row)));
      trackEvent("collection-add", { count: added.length });
      return added;
    },
  });
}

export function useMoveCopies() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const copiesCollection = useCopiesCollection();

  return useMutation({
    networkMode: "always",
    mutationFn: async ({
      copyIds,
      toCollectionId,
    }: {
      copyIds: string[];
      toCollectionId: string;
    }) => {
      if (!userId || !copiesCollection) {
        throw new Error(m.collections_copies_signed_out());
      }
      const collection = copiesCollection;
      const present = copyIds.filter((id) => collection.has(id));
      if (present.length === 0) {
        return;
      }
      const groupId = groupIdForCollection(queryClient, userId, toCollectionId);
      const transaction = collection.update(present, (drafts) => {
        for (const draft of drafts) {
          draft.collectionId = toCollectionId;
          draft.groupId = groupId;
        }
      });
      await transaction.isPersisted.promise;
    },
  });
}

/**
 * Applies one metadata patch (condition, grading, notes, links) to a batch of
 * copies, optimistically.
 */
export function useUpdateCopies() {
  const userId = useUserId();
  const copiesCollection = useCopiesCollection();

  return useMutation({
    networkMode: "always",
    mutationFn: async ({ copyIds, patch }: { copyIds: string[]; patch: CopyMetadataPatch }) => {
      if (!userId || !copiesCollection) {
        throw new Error(m.collections_copies_signed_out());
      }
      const collection = copiesCollection;
      const present = copyIds.filter((id) => collection.has(id));
      if (present.length === 0) {
        return;
      }
      await updateCopyMetadata(collection, present, patch).isPersisted.promise;
    },
  });
}

export function useDisposeCopies() {
  const userId = useUserId();
  const copiesCollection = useCopiesCollection();

  return useMutation({
    networkMode: "always",
    mutationFn: async ({ copyIds }: { copyIds: string[] }) => {
      if (!userId || !copiesCollection) {
        throw new Error(m.collections_copies_signed_out());
      }
      const collection = copiesCollection;
      const present = copyIds.filter((id) => collection.has(id));
      if (present.length === 0) {
        return;
      }
      await collection.delete(present).isPersisted.promise;
      trackEvent("collection-remove", { count: present.length });
    },
  });
}

const BATCH_DELAY = 300;

interface PendingAdd {
  printingId: string;
}

interface BatchedAddCallbacks {
  onBatchSuccess?: (printingIds: string[]) => void;
  onBatchError?: (printingIds: string[], error: unknown) => void;
}

async function commitBatch(
  transaction: Transaction<CopyResponse>,
  printingIds: string[],
  queryClient: QueryClient,
  callbacks: BatchedAddCallbacks | undefined,
): Promise<void> {
  try {
    await transaction.commit();
  } catch (error) {
    reportMutationError(error instanceof Error ? error : new Error(String(error)), queryClient);
    callbacks?.onBatchError?.(printingIds, error);
    return;
  }
  trackEvent("collection-add", { count: printingIds.length });
  callbacks?.onBatchSuccess?.(printingIds);
}

/**
 * Inserts each add into the copies collection at once, so owned counts update
 * immediately, and sends rapid adds as one request.
 */
export function useBatchedAddCopies(callbacks?: BatchedAddCallbacks) {
  const copiesCollection = useCopiesCollection();
  const queryClient = useQueryClient();
  const userId = useUserId();
  // useBatcher captures its handler once; ref keeps callbacks current without
  // recreating it. Updated in an effect, not during render, to satisfy React Compiler.
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });
  const openTransactionRef = useRef<Transaction<CopyResponse> | null>(null);

  const batcher = useBatcher<PendingAdd>(
    (pending) => {
      const transaction = openTransactionRef.current;
      openTransactionRef.current = null;
      if (transaction) {
        void commitBatch(
          transaction,
          pending.map((entry) => entry.printingId),
          queryClient,
          callbacksRef.current,
        );
      }
    },
    // Without this the default cancel strands the open transaction: its adds never
    // persist, never roll back, and every caller's promise hangs.
    { wait: BATCH_DELAY, onUnmount: (open) => open.flush() },
  );

  const add = (
    printingId: string,
    collectionId: string,
    copyId?: string,
    batchId?: string,
  ): Promise<CopyResponse> => {
    if (!copiesCollection || !userId) {
      const error = new Error(m.collections_copies_signed_out());
      reportMutationError(error, queryClient);
      return Promise.reject(error);
    }
    const collection = copiesCollection;
    const row = optimisticCopy(queryClient, userId, { id: copyId, printingId, collectionId });
    if (collection.has(row.id)) {
      return waitForInsert(collection, row);
    }
    const transaction =
      openTransactionRef.current ??
      createTransaction<CopyResponse>({
        autoCommit: false,
        mutationFn: ({ transaction: batch }) =>
          persistCopyMutations(collection, batch.mutations, { queryClient, userId }),
      });
    openTransactionRef.current = transaction;
    transaction.mutate(() => {
      collection.insert(row, batchId === undefined ? undefined : { metadata: { batchId } });
    });
    trackPendingInserts(collection, [row.id], transaction);
    batcher.addItem({ printingId });
    return waitForInsert(collection, row);
  };

  return { add };
}
