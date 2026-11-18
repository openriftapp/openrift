import { COMPARABLE_CARD_FIELDS, differingFields } from "@openrift/shared/catalog-field-compare";
import type {
  WorkspaceUploadSource,
  WorkspaceUploadsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";

import type { AdminAccess } from "../../../middleware/require-admin.js";
import { reviewableProviderScope } from "../lib/card-review-scope.js";
import type { WorkspaceCardDifferenceRow } from "../repositories/workspace-queue.js";
import type { WorkspaceUploadEventRow } from "../repositories/workspace-records.js";
import type { WorkspaceRepos } from "./workspace-queue.js";
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
    const differing = new Set(differingFields(COMPARABLE_CARD_FIELDS, row.live, row.candidate));
    for (const field of COMPARABLE_CARD_FIELDS.filter((name) => differing.has(name))) {
      const value = JSON.stringify(row.candidate[field] ?? null);
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
  cardDifferences: readonly WorkspaceCardDifferenceRow[],
): WorkspaceUploadsResponse {
  const sources = uploads
    .toSorted((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
    .map((upload): WorkspaceUploadSource => ({
      provider: upload.provider,
      label: upload.provider,
      uploadedAt: upload.uploadedAt.toISOString(),
      newCards: countOf(upload.counts, "newCards"),
      newPrintings: countOf(upload.counts, "newPrintings"),
      updates: countOf(upload.counts, "updates", "printingUpdates"),
      removed: countOf(upload.counts, "removedCards", "removedPrintings"),
      repeatedDifference: largestRepeatedDifference(cardDifferences, upload.provider),
    }));
  return { sources };
}

export async function buildWorkspaceUploads(
  repos: Pick<WorkspaceRepos, "workspaceRecords" | "workspaceQueue" | "providerSettings">,
  options: { access: AdminAccess | null },
): Promise<WorkspaceUploadsResponse> {
  const [scope, uploads, cardDifferences] = await Promise.all([
    reviewableProviderScope(options.access, repos.providerSettings),
    repos.workspaceRecords.latestUploads(),
    repos.workspaceQueue.uncheckedCardDifferences(),
  ]);
  const inScope = (provider: string): boolean => scope === null || scope.has(provider);
  return toWorkspaceUploads(
    uploads.filter((row) => inScope(row.provider)),
    cardDifferences.filter((row) => inScope(row.provider)),
  );
}
