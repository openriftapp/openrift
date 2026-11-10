import type { MoveListEntriesResolution } from "@openrift/shared/contracts/lists";
import { listsContract } from "@openrift/shared/contracts/lists";
import type {
  ListBulkAddResponse,
  ListDetailResponse,
  ListEntryResponse,
  ListIntent,
  ListListResponse,
  ListMoveResponse,
  ListResponse,
} from "@openrift/shared/types/api/list";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { withTradeCancelConsent } from "@/features/groups/stores/trade-cancel-consent-store";
import {
  listDetailQueryOptions,
  listsQueryOptions,
  publicListQueryOptions,
} from "@/features/lists/lib/lists-queries";
import { listsKeys } from "@/features/lists/lib/lists-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useOptimisticMutation } from "@/hooks/use-optimistic-mutation";
import { useRequiredUserId } from "@/hooks/use-session";
import { reportMutationError } from "@/lib/query-client";
import { reorderInPlace } from "@/lib/reorder-in-place";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";

type CreateListInput = ContractInput<typeof listsContract, "create">;
type UpdateListInput = Omit<ContractInput<typeof listsContract, "update">, "id"> & {
  listId: string;
};
type UpdateListEntryInput = Omit<
  ContractInput<typeof listsContract, "updateEntry">,
  "id" | "itemId"
> & {
  listId: string;
  entryId: string;
};

function listsApi() {
  return browserApiOrpcClient(listsContract);
}

function updateList({ listId, ...fields }: UpdateListInput): Promise<ListResponse> {
  return withTradeCancelConsent((cancelTradeIds) =>
    listsApi().update({ id: listId, ...fields, cancelTradeIds }),
  );
}

function updateListEntry({
  listId,
  entryId,
  ...fields
}: UpdateListEntryInput): Promise<ListEntryResponse> {
  return listsApi().updateEntry({ id: listId, itemId: entryId, ...fields });
}

export function useLists(intent?: ListIntent) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(listsQueryOptions(userId, intent));
}

export function useListDetail(listId: string) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(listDetailQueryOptions(userId, listId));
}

export function useCreateList() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation({
    mutationFn: (body: CreateListInput) => listsApi().create(body),
    invalidates: (variables) => [listsKeys.all(userId), listsKeys.all(userId, variables.intent)],
  });
}

export function useUpdateList() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<ListResponse, UpdateListInput>({
    mutationFn: (input) => updateList(input),
    invalidates: (variables) => [listsKeys.all(userId), listsKeys.detail(userId, variables.listId)],
  });
}

export function useSetListSidebarHidden() {
  const userId = useRequiredUserId();
  return useOptimisticMutation<ListListResponse, { listId: string; hidden: boolean }, ListResponse>(
    {
      queryKey: listsKeys.all(userId),
      mutationFn: ({ listId, hidden }) => updateList({ listId, sidebarHidden: hidden }),
      apply: (cached, { listId, hidden }) => ({
        ...cached,
        items: cached.items.map((list) =>
          list.id === listId ? { ...list, sidebarHidden: hidden } : list,
        ),
      }),
    },
  );
}

export function useDeleteList() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, string>({
    mutationFn: (listId) =>
      withTradeCancelConsent((cancelTradeIds) => listsApi().remove({ id: listId, cancelTradeIds })),
    invalidates: [listsKeys.all(userId)],
  });
}

export function useReorderLists() {
  const userId = useRequiredUserId();
  return useOptimisticMutation<ListListResponse, { intent: ListIntent; orderedIds: string[] }>({
    queryKey: listsKeys.all(userId),
    mutationFn: (variables) => listsApi().reorder(variables),
    apply: (cached, { orderedIds }) => ({
      ...cached,
      items: reorderInPlace(cached.items, orderedIds),
    }),
  });
}

interface BulkAddVariables {
  listId: string;
  entries: {
    cardId?: string;
    printingId?: string;
    copyId?: string;
    quantity?: number;
  }[];
}

export function useBulkAddListEntries() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation<
    ListBulkAddResponse,
    Error,
    BulkAddVariables,
    { prev: ListDetailResponse | undefined }
  >({
    mutationFn: (vars) => listsApi().bulkCreateEntries({ id: vars.listId, entries: vars.entries }),
    // Bumps a matching existing entry's quantity before the server responds. Fresh
    // adds wait for the refetch: there's no card/printing detail here to fabricate one.
    onMutate: async (vars) => {
      const detailKey = listsKeys.detail(userId, vars.listId);
      await queryClient.cancelQueries({ queryKey: detailKey });
      const prev = queryClient.getQueryData<ListDetailResponse>(detailKey);
      queryClient.setQueryData<ListDetailResponse>(detailKey, (old) => {
        if (!old) {
          return old;
        }
        let entries = old.entries;
        for (const item of vars.entries) {
          const delta = item.quantity ?? 1;
          const idx = entries.findIndex((entry) => {
            if (item.cardId !== undefined && entry.kind === "card") {
              return entry.cardId === item.cardId;
            }
            if (item.printingId !== undefined && entry.kind === "printing") {
              return entry.printingId === item.printingId;
            }
            if (item.copyId !== undefined && entry.kind === "copy") {
              return entry.copyId === item.copyId;
            }
            return false;
          });
          const existing = entries[idx];
          if (existing !== undefined) {
            entries = [
              ...entries.slice(0, idx),
              { ...existing, quantity: existing.quantity + delta },
              ...entries.slice(idx + 1),
            ];
          }
        }
        return { ...old, entries };
      });
      return { prev };
    },
    onError: (err, vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(listsKeys.detail(userId, vars.listId), context.prev);
      }
      // Replaces the QueryClient's default onError; report here or the revert is silent.
      reportMutationError(err, queryClient);
    },
    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: listsKeys.all(userId) });
      void queryClient.invalidateQueries({ queryKey: listsKeys.detail(userId, vars.listId) });
    },
  });
}

export function useBulkAddCopiesToList() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<
    ListBulkAddResponse,
    { listId: string; copyIds: string[]; cardId?: string }
  >({
    mutationFn: (vars) =>
      listsApi().bulkAddFromCopies({ id: vars.listId, copyIds: vars.copyIds, cardId: vars.cardId }),
    invalidates: (variables) => [listsKeys.all(userId), listsKeys.detail(userId, variables.listId)],
  });
}

interface MoveListEntriesInput {
  fromListId: string;
  toListId: string;
  entryIds: string[];
  resolutions?: MoveListEntriesResolution[];
  mode?: "move" | "copy";
}

export function useMoveListEntries() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<ListMoveResponse, MoveListEntriesInput>({
    mutationFn: (vars) =>
      withTradeCancelConsent((cancelTradeIds) =>
        listsApi().moveEntries({
          id: vars.fromListId,
          toListId: vars.toListId,
          entryIds: vars.entryIds,
          resolutions: vars.resolutions,
          mode: vars.mode,
          cancelTradeIds,
        }),
      ),
    invalidates: (variables) => [
      listsKeys.all(userId),
      listsKeys.detail(userId, variables.fromListId),
      listsKeys.detail(userId, variables.toListId),
    ],
  });
}

export function useUpdateListEntry() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation<
    ListEntryResponse,
    Error,
    UpdateListEntryInput,
    { prev: ListDetailResponse | undefined }
  >({
    mutationFn: (vars) => updateListEntry(vars),
    onMutate: async (vars) => {
      const detailKey = listsKeys.detail(userId, vars.listId);
      await queryClient.cancelQueries({ queryKey: detailKey });
      const prev = queryClient.getQueryData<ListDetailResponse>(detailKey);
      queryClient.setQueryData<ListDetailResponse>(detailKey, (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          entries: old.entries.map((entry) =>
            entry.id === vars.entryId
              ? {
                  ...entry,
                  ...(vars.quantity !== undefined && { quantity: vars.quantity }),
                  ...(vars.tradeOverride !== undefined && { tradeOverride: vars.tradeOverride }),
                }
              : entry,
          ),
        };
      });
      return { prev };
    },
    onError: (err, vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(listsKeys.detail(userId, vars.listId), context.prev);
      }
      // Replaces the QueryClient's default onError; report here or the revert is silent.
      reportMutationError(err, queryClient);
    },
    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: listsKeys.all(userId) });
      void queryClient.invalidateQueries({ queryKey: listsKeys.detail(userId, vars.listId) });
    },
  });
}

export function useRemoveListEntry() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, { listId: string; entryId: string }>({
    mutationFn: (vars) =>
      withTradeCancelConsent((cancelTradeIds) =>
        listsApi().removeEntry({ id: vars.listId, itemId: vars.entryId, cancelTradeIds }),
      ),
    invalidates: (variables) => [listsKeys.all(userId), listsKeys.detail(userId, variables.listId)],
  });
}

export function useDecrementListEntries() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, { entries: { entryId: string; by: number }[] }>({
    mutationFn: (vars) =>
      withTradeCancelConsent((cancelTradeIds) =>
        listsApi().decrementEntries({ ...vars, cancelTradeIds }),
      ),
    invalidates: [listsKeys.all(userId)],
  });
}

export function useBulkRemoveListEntries() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, { listId: string; entryIds: string[] }>({
    mutationFn: (vars) =>
      withTradeCancelConsent((cancelTradeIds) =>
        listsApi().bulkDeleteEntries({ id: vars.listId, entryIds: vars.entryIds, cancelTradeIds }),
      ),
    invalidates: (variables) => [listsKeys.all(userId), listsKeys.detail(userId, variables.listId)],
  });
}

export function useShareList() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => listsApi().share({ id: listId }),
    onSuccess: (data, listId) => {
      queryClient.setQueryData<ListDetailResponse>(listsKeys.detail(userId, listId), (old) =>
        old
          ? {
              ...old,
              list: { ...old.list, shareToken: data.shareToken, isPublic: data.isPublic },
            }
          : old,
      );
    },
  });
}

export function useUnshareList() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => listsApi().unshare({ id: listId }),
    onSuccess: (_, listId) => {
      queryClient.setQueryData<ListDetailResponse>(listsKeys.detail(userId, listId), (old) =>
        old ? { ...old, list: { ...old.list, shareToken: null, isPublic: false } } : old,
      );
    },
  });
}

export function usePublicList(token: string) {
  return useSuspenseQuery(publicListQueryOptions(token));
}
