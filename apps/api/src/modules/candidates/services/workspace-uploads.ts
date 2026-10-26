import { COMPARABLE_CARD_FIELDS, differingFields } from "@openrift/shared/catalog-field-compare";
import type {
  WorkspaceQueueItem,
  WorkspaceUploadSource,
  WorkspaceUploadsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";

import type { AdminAccess } from "../../../middleware/require-admin.js";
import { reviewableProviderScope } from "../lib/card-review-scope.js";
import type { WorkspaceCardDifferenceRow } from "../repositories/workspace-queue.js";
import type { WorkspaceUploadEventRow } from "../repositories/workspace-records.js";
import type { WorkspaceRepos } from "./workspace-queue.js";
import { buildWorkspaceQueue } from "./workspace-queue.js";
import { matchSameDifference } from "./workspace-same-difference.js";

type CardField = (typeof COMPARABLE_CARD_FIELDS)[number];
type RepeatedDifference = NonNullable<WorkspaceUploadSource["repeatedDifference"]>;

function countOf(counts: Record<string, unknown> | null, ...keys: string[]): number {
  let total = 0;
  for (const key of keys) {
    const value = counts?.[key];
    if (typeof value === "number") {
      total += value;
    }
  }
  return total;
}

/** `value` is JSON-encoded, ready for the same-difference endpoint. */
export function largestRepeatedDifference(
  rows: readonly WorkspaceCardDifferenceRow[],
  provider: string,
): RepeatedDifference | null {
  const groups = new Map<string, { field: CardField; value: string; count: number }>();
  for (const row of rows) {
    if (row.provider !== provider) {
      continue;
    }
    const candidate = row.candidate as unknown as Record<string, unknown>;
    const differing = new Set(differingFields(COMPARABLE_CARD_FIELDS, row.live, row.candidate));
    for (const field of COMPARABLE_CARD_FIELDS.filter((name) => differing.has(name))) {
      const value = JSON.stringify(candidate[field] ?? null);
      const key = `${field}\u0000${value}`;
      const group = groups.get(key);
      if (group === undefined) {
        groups.set(key, { field, value, count: 1 });
      } else {
        group.count += 1;
      }
    }
  }
  const [top] = [...groups.values()].toSorted(
    (a, b) => b.count - a.count || a.field.localeCompare(b.field) || a.value.localeCompare(b.value),
  );
  if (top === undefined || top.count < 2) {
    return null;
  }
  const count = matchSameDifference(rows, {
    provider,
    field: top.field,
    value: top.value,
  }).length;
  return count > 1 ? { field: top.field, value: top.value, count } : null;
}

export function toWorkspaceUploads(
  uploads: readonly WorkspaceUploadEventRow[],
  items: readonly WorkspaceQueueItem[],
  cardDifferences: readonly WorkspaceCardDifferenceRow[],
): WorkspaceUploadsResponse {
  const byProvider = Map.groupBy(
    items.filter((item) => item.provider !== null),
    (item) => item.provider as string,
  );
  const sources = uploads
    .toSorted((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
    .map((upload): WorkspaceUploadSource => {
      const own = byProvider.get(upload.provider) ?? [];
      const oldest = own.reduce<string | null>(
        (min, item) => (min === null || item.createdAt < min ? item.createdAt : min),
        null,
      );
      return {
        provider: upload.provider,
        label: upload.provider,
        uploadedAt: upload.uploadedAt.toISOString(),
        newCards: countOf(upload.counts, "newCards"),
        newPrintings: countOf(upload.counts, "newPrintings"),
        updates: countOf(upload.counts, "updates", "printingUpdates"),
        removed: countOf(upload.counts, "removedCards", "removedPrintings"),
        open: own.filter((item) => item.segment === "open").length,
        new: own.filter((item) => item.segment === "new").length,
        oldestOpenAt: oldest,
        repeatedDifference: largestRepeatedDifference(cardDifferences, upload.provider),
      };
    });
  const contributorItems = items.filter((item) => item.isContributor);
  const since = contributorItems.reduce<string | null>(
    (min, item) => (min === null || item.createdAt < min ? item.createdAt : min),
    null,
  );
  return { sources, contributors: { since, count: contributorItems.length } };
}

export async function buildWorkspaceUploads(
  repos: WorkspaceRepos,
  options: { access: AdminAccess | null; userId: string; now: Date },
): Promise<WorkspaceUploadsResponse> {
  const scope = await reviewableProviderScope(options.access, repos.providerSettings);
  const inScope = (provider: string): boolean => scope === null || scope.has(provider);
  const [uploads, queue, cardDifferences] = await Promise.all([
    repos.workspaceRecords.latestUploads(),
    buildWorkspaceQueue(repos, options),
    repos.workspaceQueue.uncheckedCardDifferences(),
  ]);
  return toWorkspaceUploads(
    uploads.filter((row) => inScope(row.provider)),
    queue.items,
    cardDifferences.filter((row) => inScope(row.provider)),
  );
}
