import type {
  WorkspaceAcceptTrustedCardsResponse,
  WorkspaceAcceptTrustedPrintingsResponse,
  WorkspaceAssignSuggestedListingsResponse,
  WorkspaceSuggestedListingsPreview,
  WorkspaceTrustedCardsPreview,
  WorkspaceTrustedPrintingsPreview,
} from "@openrift/shared/contracts/admin/catalog-workspace-batch";
import { adminCatalogWorkspaceBatchContract } from "@openrift/shared/contracts/admin/catalog-workspace-batch";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { pluralize } from "@openrift/shared/strings";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export type BatchKind = "trusted-cards" | "trusted-printings" | "suggested-listings";

export interface BatchReason {
  key: string;
  label: string;
  reason: string;
}

export interface BatchPreview {
  count: number;
  names: string[];
  keys: string[];
  ineligible: BatchReason[];
}

export interface BatchOutcome {
  done: number;
  skipped: BatchReason[];
}

type RunResponse =
  | WorkspaceAcceptTrustedCardsResponse
  | WorkspaceAcceptTrustedPrintingsResponse
  | WorkspaceAssignSuggestedListingsResponse;

const fetchTrustedCardsPreview = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<WorkspaceTrustedCardsPreview> =>
    apiOrpcClient(
      adminCatalogWorkspaceBatchContract,
      context.cookie,
    ).workspaceTrustedCardsPreview(),
  );

const acceptTrustedCardsFn = createServerFn({ method: "POST" })
  .validator((input: { names: string[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceAcceptTrustedCardsResponse> =>
    apiOrpcClient(adminCatalogWorkspaceBatchContract, context.cookie).workspaceAcceptTrustedCards(
      data,
    ),
  );

const fetchTrustedPrintingsPreview = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<WorkspaceTrustedPrintingsPreview> =>
    apiOrpcClient(
      adminCatalogWorkspaceBatchContract,
      context.cookie,
    ).workspaceTrustedPrintingsPreview(),
  );

const acceptTrustedPrintingsFn = createServerFn({ method: "POST" })
  .validator((input: { candidatePrintingIds: string[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceAcceptTrustedPrintingsResponse> =>
    apiOrpcClient(
      adminCatalogWorkspaceBatchContract,
      context.cookie,
    ).workspaceAcceptTrustedPrintings(data),
  );

const fetchSuggestedListingsPreview = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<WorkspaceSuggestedListingsPreview> =>
    apiOrpcClient(
      adminCatalogWorkspaceBatchContract,
      context.cookie,
    ).workspaceSuggestedListingsPreview(),
  );

const assignSuggestedListingsFn = createServerFn({ method: "POST" })
  .validator((input: { listingKeys: string[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceAssignSuggestedListingsResponse> =>
    apiOrpcClient(
      adminCatalogWorkspaceBatchContract,
      context.cookie,
    ).workspaceAssignSuggestedListings(data),
  );

export function suggestedListingsPreview(
  response: WorkspaceSuggestedListingsPreview,
): BatchPreview {
  return {
    count: response.count,
    names: response.items.map((item) => item.label),
    keys: response.items.map((item) => item.listingKey),
    ineligible: [],
  };
}

export function batchPreviewQueryKey(kind: BatchKind | "ready") {
  return [...adminKeys.workspace, "batch", kind] as const;
}

export interface ReadyPreview {
  cards: WorkspaceTrustedCardsPreview;
  printings: WorkspaceTrustedPrintingsPreview;
}

export function readyPreviewQueryOptions() {
  return queryOptions({
    queryKey: batchPreviewQueryKey("ready"),
    queryFn: async (): Promise<ReadyPreview> => {
      const [cards, printings] = await Promise.all([
        fetchTrustedCardsPreview(),
        fetchTrustedPrintingsPreview(),
      ]);
      return { cards, printings };
    },
    staleTime: MINUTE_MS,
  });
}

export function toBatchOutcome(response: RunResponse): BatchOutcome {
  return {
    done: "assigned" in response ? response.assigned : response.accepted,
    skipped: response.skipped.map((entry, index) => {
      const label = "name" in entry ? entry.name : entry.label;
      return { key: `${index}:${label}`, label, reason: entry.reason };
    }),
  };
}

export function listingsBatchLabel(count: number): string {
  return `Map ${count} ${pluralize(count, "listing")} by suggestion`;
}

const OUTCOME_NOUNS: Record<BatchKind, string> = {
  "trusted-cards": "card",
  "trusted-printings": "printing",
  "suggested-listings": "listing",
};

export function batchOutcomeText(kind: BatchKind, outcome: BatchOutcome): string {
  const verb = kind === "suggested-listings" ? "Assigned" : "Accepted";
  const done = `${verb} ${outcome.done} ${pluralize(outcome.done, OUTCOME_NOUNS[kind])}.`;
  return outcome.skipped.length === 0 ? done : `${done} ${outcome.skipped.length} skipped.`;
}

async function runBatch(
  kind: BatchKind,
  keys: string[],
  signal?: AbortSignal,
): Promise<BatchOutcome> {
  switch (kind) {
    case "trusted-cards": {
      return toBatchOutcome(await acceptTrustedCardsFn({ data: { names: keys }, signal }));
    }
    case "trusted-printings": {
      return toBatchOutcome(
        await acceptTrustedPrintingsFn({ data: { candidatePrintingIds: keys }, signal }),
      );
    }
    case "suggested-listings": {
      return toBatchOutcome(
        await assignSuggestedListingsFn({ data: { listingKeys: keys }, signal }),
      );
    }
  }
}

export function useBatchRun(kind: BatchKind) {
  return useMutationWithInvalidation({
    meta: { inlineError: true },
    mutationFn: (keys: string[], signal) => runBatch(kind, keys, signal),
    invalidates: [
      adminKeys.workspace,
      adminKeys.cards.list,
      adminKeys.reviewQueue,
      ...(kind === "suggested-listings" ? [adminKeys.unifiedMappings.all] : []),
    ],
  });
}

export function useListingsBatchPreview(): BatchPreview | undefined {
  const preview = useQuery({
    queryKey: batchPreviewQueryKey("suggested-listings"),
    queryFn: async () => suggestedListingsPreview(await fetchSuggestedListingsPreview()),
    staleTime: MINUTE_MS,
  });
  return preview.data;
}
