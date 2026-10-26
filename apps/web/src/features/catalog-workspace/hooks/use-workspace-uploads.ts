import { COMPARABLE_CARD_FIELDS } from "@openrift/shared/catalog-field-compare";
import type { ComparableCardField } from "@openrift/shared/catalog-field-compare";
import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import type {
  WorkspaceOwner,
  WorkspaceQueueItem,
  WorkspaceSegment,
  WorkspaceUploadSource,
  WorkspaceUploadsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import type { WorkspaceSameDifferenceInput } from "@openrift/shared/contracts/admin/catalog-workspace-bulk";
import { pluralize } from "@openrift/shared/strings";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchWorkspaceUploads = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<WorkspaceUploadsResponse> =>
    apiOrpcClient(adminCatalogWorkspaceContract, context.cookie).workspaceUploads(),
  );

function workspaceUploadsQueryOptions() {
  return queryOptions({
    queryKey: [...adminKeys.workspace, "uploads"] as const,
    queryFn: () => fetchWorkspaceUploads(),
    staleTime: 60 * 1000,
  });
}

export function useWorkspaceUploads(enabled: boolean) {
  return useQuery({ ...workspaceUploadsQueryOptions(), enabled });
}

export function splitUploadSources(sources: readonly WorkspaceUploadSource[]): {
  active: WorkspaceUploadSource[];
  quiet: WorkspaceUploadSource[];
} {
  const sorted = sources.toSorted(
    (a, b) =>
      b.open - a.open ||
      b.new - a.new ||
      b.uploadedAt.localeCompare(a.uploadedAt) ||
      a.label.localeCompare(b.label),
  );
  return {
    active: sorted.filter((source) => source.open + source.new > 0),
    quiet: sorted.filter((source) => source.open + source.new === 0),
  };
}

export function uploadChangeSummary(source: WorkspaceUploadSource): string {
  const parts = [
    source.newCards > 0 && `${source.newCards} new ${pluralize(source.newCards, "card")}`,
    source.newPrintings > 0 &&
      `${source.newPrintings} new ${pluralize(source.newPrintings, "printing")}`,
    source.updates > 0 && `${source.updates} ${pluralize(source.updates, "update")}`,
    source.removed > 0 && `${source.removed} removed`,
  ].filter((part): part is string => typeof part === "string");
  return parts.length === 0 ? "No changes" : parts.join(", ");
}

export function uploadOpenSummary(source: WorkspaceUploadSource): string {
  const parts = [
    source.open > 0 && `${source.open} open`,
    source.new > 0 && `${source.new} new`,
  ].filter((part): part is string => typeof part === "string");
  return parts.length === 0 ? "Nothing open" : parts.join(", ");
}

export function providerQueueLink(
  items: readonly WorkspaceQueueItem[],
  provider: string,
): { owner: WorkspaceOwner; segment: WorkspaceSegment } {
  const counts = new Map<WorkspaceOwner, { open: number; new: number }>();
  for (const item of items) {
    if (item.provider !== provider) {
      continue;
    }
    const count = counts.get(item.owner) ?? { open: 0, new: 0 };
    count[item.segment] += 1;
    counts.set(item.owner, count);
  }
  let best: { owner: WorkspaceOwner; open: number; new: number } | null = null;
  for (const [owner, count] of counts) {
    if (best === null || count.open + count.new > best.open + best.new) {
      best = { owner, ...count };
    }
  }
  if (best === null) {
    return { owner: "card", segment: "open" };
  }
  return { owner: best.owner, segment: best.open > 0 ? "open" : "new" };
}

function isComparableCardField(field: string): field is ComparableCardField {
  return (COMPARABLE_CARD_FIELDS as readonly string[]).includes(field);
}

export function repeatedDifferenceInput(
  source: WorkspaceUploadSource,
): WorkspaceSameDifferenceInput | null {
  const repeated = source.repeatedDifference;
  if (repeated === null || repeated.count <= 1 || !isComparableCardField(repeated.field)) {
    return null;
  }
  return { provider: source.provider, field: repeated.field, value: repeated.value };
}
