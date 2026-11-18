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
import type { ListRule, ListRuleCombine } from "@openrift/shared/types/list-rule";
import { safe } from "@orpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { withTradeCancelConsent } from "@/features/groups/stores/trade-cancel-consent-store";
import type { BulkAddVariables } from "@/features/lists/lib/list-entry-writes";
import {
  bulkAddItemMatches,
  entryStepsSettled,
  LIST_ENTRY_MUTATION_KEYS,
  listEntryWritesInFlight,
  steppedManualQuantity,
  entryTotalQuantity,
} from "@/features/lists/lib/list-entry-writes";
import type { ListRulesState } from "@/features/lists/lib/list-rules-conflict";
import { listRulesConflict } from "@/features/lists/lib/list-rules-conflict";
import {
  listDetailQueryOptions,
  listsQueryOptions,
  publicListQueryOptions,
} from "@/features/lists/lib/lists-queries";
import { listsKeys } from "@/features/lists/lib/lists-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useOptimisticMutation } from "@/hooks/use-optimistic-mutation";
import { useRequiredUserId } from "@/hooks/use-session";
import { reorderInPlace } from "@/lib/reorder-in-place";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";

type CreateListInput = ContractInput<typeof listsContract, "create">;
type DropFromListRulesInput = Omit<
  ContractInput<typeof listsContract, "dropFromRules">,
  "id" | "cancelTradeIds"
> & {
  listId: string;
};
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

interface SaveListRulesInput {
  listId: string;
  rules: ListRule[];
  ruleCombine: ListRuleCombine | null;
  expectedRulesVersion: number;
}

export type SaveListRulesResult = { outcome: "saved" } | ({ outcome: "stale" } & ListRulesState);

async function saveListRules(input: SaveListRulesInput): Promise<SaveListRulesResult> {
  const { error } = await safe(updateList(input));
  if (!error) {
    return { outcome: "saved" };
  }
  const stored = listRulesConflict(error);
  if (stored === undefined) {
    throw error;
  }
  return { outcome: "stale", ...stored };
}

/** A save made from an older rules version resolves `stale` with the stored rules; nothing is written. */
export function useSaveListRules() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<SaveListRulesResult, SaveListRulesInput>({
    mutationFn: (input) => saveListRules(input),
    invalidates: (variables) => [listsKeys.all(userId), listsKeys.detail(userId, variables.listId)],
    meta: { inlineError: true },
  });
}

export function useDropFromListRules() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<ListResponse, DropFromListRulesInput>({
    mutationFn: ({ listId, ...target }) =>
      withTradeCancelConsent((cancelTradeIds) =>
        listsApi().dropFromRules({ id: listId, ...target, cancelTradeIds }),
      ),
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

export function useBulkAddListEntries() {
  const userId = useRequiredUserId();
  return useOptimisticMutation<ListDetailResponse, BulkAddVariables, ListBulkAddResponse>({
    mutationKey: LIST_ENTRY_MUTATION_KEYS.add,
    queryKey: (vars) => listsKeys.detail(userId, vars.listId),
    mutationFn: (vars) => listsApi().bulkCreateEntries({ id: vars.listId, entries: vars.entries }),
    // Bumps a matching existing entry's quantity before the server responds. Fresh
    // adds wait for the refetch: there's no card/printing detail here to fabricate one.
    apply: (cached, vars) => {
      let entries = cached.entries;
      for (const item of vars.entries) {
        const delta = item.quantity ?? 1;
        const idx = entries.findIndex((entry) => bulkAddItemMatches(item, entry));
        const existing = entries[idx];
        if (existing !== undefined) {
          entries = [
            ...entries.slice(0, idx),
            { ...existing, quantity: existing.quantity + delta },
            ...entries.slice(idx + 1),
          ];
        }
      }
      return { ...cached, entries };
    },
    invalidates: [listsKeys.all(userId)],
    pendingWrites: (mutationCache, vars) => listEntryWritesInFlight(mutationCache, vars.listId),
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
  return useOptimisticMutation<ListDetailResponse, UpdateListEntryInput, ListEntryResponse>({
    mutationKey: LIST_ENTRY_MUTATION_KEYS.update,
    queryKey: (vars) => listsKeys.detail(userId, vars.listId),
    mutationFn: (vars) => updateListEntry(vars),
    apply: (cached, vars) => ({
      ...cached,
      entries: cached.entries.map((entry) =>
        entry.id === vars.entryId
          ? {
              ...entry,
              ...(vars.quantity !== undefined && {
                quantity: entryTotalQuantity(entry, vars.quantity),
              }),
              ...(vars.quantityDelta !== undefined && {
                quantity: entryTotalQuantity(
                  entry,
                  steppedManualQuantity(entry, vars.quantityDelta),
                ),
              }),
              ...(vars.tradeOverride !== undefined && { tradeOverride: vars.tradeOverride }),
            }
          : entry,
      ),
    }),
    invalidates: [listsKeys.all(userId)],
    pendingWrites: (mutationCache, vars) => listEntryWritesInFlight(mutationCache, vars.listId),
  });
}

/** A remove sent while quantity steps on the entry are in flight waits for them to land first. */
export function useRemoveListEntry() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useOptimisticMutation<ListDetailResponse, { listId: string; entryId: string }>({
    mutationKey: LIST_ENTRY_MUTATION_KEYS.remove,
    queryKey: (vars) => listsKeys.detail(userId, vars.listId),
    mutationFn: async (vars) => {
      await entryStepsSettled(queryClient.getMutationCache(), vars.listId, vars.entryId);
      return withTradeCancelConsent((cancelTradeIds) =>
        listsApi().removeEntry({ id: vars.listId, itemId: vars.entryId, cancelTradeIds }),
      );
    },
    // The entry leaves with the refetch, which waits for the list's other writes.
    apply: (cached) => cached,
    rollback: (cached) => cached,
    invalidates: [listsKeys.all(userId)],
    pendingWrites: (mutationCache, vars) => listEntryWritesInFlight(mutationCache, vars.listId),
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
