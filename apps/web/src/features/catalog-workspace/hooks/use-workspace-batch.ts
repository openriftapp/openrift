import type {
  WorkspaceAcceptTrustedCardsResponse,
  WorkspaceAcceptTrustedPrintingsResponse,
  WorkspaceAssignSuggestedListingsResponse,
  WorkspaceSuggestedListingsPreview,
  WorkspaceTrustedCardsPreview,
  WorkspaceTrustedPrintingsPreview,
} from "@openrift/shared/contracts/admin/catalog-workspace-batch";
import { adminCatalogWorkspaceBatchContract } from "@openrift/shared/contracts/admin/catalog-workspace-batch";
import { pluralize } from "@openrift/shared/strings";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export type BatchKind = "trusted-cards" | "trusted-printings" | "suggested-listings";

export interface BatchPreview {
  count: number;
  names: string[];
  keys: string[];
}

export interface BatchOutcome {
  done: number;
  skipped: { label: string; reason: string }[];
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
  .middleware([withCookies])
  .handler(({ context }): Promise<WorkspaceAcceptTrustedCardsResponse> =>
    apiOrpcClient(adminCatalogWorkspaceBatchContract, context.cookie).workspaceAcceptTrustedCards(),
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
  .middleware([withCookies])
  .handler(({ context }): Promise<WorkspaceAcceptTrustedPrintingsResponse> =>
    apiOrpcClient(
      adminCatalogWorkspaceBatchContract,
      context.cookie,
    ).workspaceAcceptTrustedPrintings(),
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
  .validator((input: { listingKeys?: string[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<WorkspaceAssignSuggestedListingsResponse> =>
    apiOrpcClient(
      adminCatalogWorkspaceBatchContract,
      context.cookie,
    ).workspaceAssignSuggestedListings(data),
  );

export function trustedCardsPreview(response: WorkspaceTrustedCardsPreview): BatchPreview {
  return { count: response.count, names: response.names, keys: response.names };
}

export function trustedPrintingsPreview(response: WorkspaceTrustedPrintingsPreview): BatchPreview {
  return {
    count: response.count,
    names: response.items.map((item) => item.label),
    keys: response.items.map((item) => item.candidatePrintingId),
  };
}

export function suggestedListingsPreview(
  response: WorkspaceSuggestedListingsPreview,
): BatchPreview {
  return {
    count: response.count,
    names: response.items.map((item) => item.label),
    keys: response.items.map((item) => item.listingKey),
  };
}

const PREVIEW_FNS: Record<BatchKind, () => Promise<BatchPreview>> = {
  "trusted-cards": async () => trustedCardsPreview(await fetchTrustedCardsPreview()),
  "trusted-printings": async () => trustedPrintingsPreview(await fetchTrustedPrintingsPreview()),
  "suggested-listings": async () => suggestedListingsPreview(await fetchSuggestedListingsPreview()),
};

export function batchPreviewQueryKey(kind: BatchKind) {
  return [...adminKeys.workspace, "batch", kind] as const;
}

export function toBatchOutcome(response: RunResponse): BatchOutcome {
  if ("assigned" in response) {
    return { done: response.assigned, skipped: [] };
  }
  return {
    done: response.accepted,
    skipped: response.skipped.map((entry) => ({
      label: "name" in entry ? entry.name : entry.label,
      reason: entry.reason,
    })),
  };
}

export function batchButtonLabel(kind: BatchKind, count: number): string {
  switch (kind) {
    case "trusted-cards": {
      return `Accept ${count} trusted ${pluralize(count, "new card")}`;
    }
    case "trusted-printings": {
      return `Accept ${count} trusted ${pluralize(count, "printing")}`;
    }
    case "suggested-listings": {
      return `Assign ${count} ${pluralize(count, "listing")} by suggestion`;
    }
  }
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

async function runBatch(kind: BatchKind, keys: string[]): Promise<BatchOutcome> {
  switch (kind) {
    case "trusted-cards": {
      return toBatchOutcome(await acceptTrustedCardsFn());
    }
    case "trusted-printings": {
      return toBatchOutcome(await acceptTrustedPrintingsFn());
    }
    case "suggested-listings": {
      return toBatchOutcome(await assignSuggestedListingsFn({ data: { listingKeys: keys } }));
    }
  }
}

export function useWorkspaceBatch(kind: BatchKind, enabled: boolean) {
  const preview = useQuery({
    queryKey: batchPreviewQueryKey(kind),
    queryFn: PREVIEW_FNS[kind],
    staleTime: 60 * 1000,
    enabled,
  });
  const run = useMutationWithInvalidation({
    mutationFn: (keys: string[]) => runBatch(kind, keys),
    invalidates: [adminKeys.workspace, adminKeys.cards.list, adminKeys.reviewQueue],
  });
  return {
    preview: preview.data,
    isPreviewPending: enabled && preview.isPending,
    run,
  };
}
