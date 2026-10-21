import type {
  WorkspaceOwner,
  WorkspaceQueueResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";

import type { Repos } from "../../../deps.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import { reviewableProviderScope } from "../lib/card-review-scope.js";
import type { WorkspaceQueueEntry } from "../lib/workspace-presenters.js";
import {
  buildWorkspaceQueueEntries,
  toWorkspaceQueueResponse,
} from "../lib/workspace-presenters.js";

export type WorkspaceRepos = Pick<
  Repos,
  | "workspaceQueue"
  | "workspaceRecords"
  | "cardSubmissions"
  | "candidateCards"
  | "providerSettings"
  | "keywords"
  | "printingDesk"
  | "adminEvents"
>;

export function isDeskOnly(access: AdminAccess | null): boolean {
  return access?.isAdmin !== true && access?.sections.includes("card-review") !== true;
}

export async function deskPrintingScope(
  repos: Pick<WorkspaceRepos, "printingDesk" | "adminEvents">,
  userId: string,
): Promise<{ promoIds: Set<string>; createdIds: Set<string> }> {
  const [promos, created] = await Promise.all([
    repos.printingDesk.listDeskPrintings({ promosOnly: true }),
    repos.adminEvents.printingIdsCreatedBy(userId),
  ]);
  return {
    promoIds: new Set(promos.map((row) => row.printingId)),
    createdIds: new Set(created),
  };
}

function deskVisible(entry: WorkspaceQueueEntry, allowed: ReadonlySet<string>): boolean {
  const { item } = entry;
  const touchesAllowed = entry.printingIds.some((id) => allowed.has(id));
  if (item.owner === "printing") {
    return item.segment === "open" && touchesAllowed;
  }
  return item.owner === "face" && item.reason === "new-image" && touchesAllowed;
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function buildWorkspaceQueue(
  repos: WorkspaceRepos,
  options: { access: AdminAccess | null; userId: string; owner?: WorkspaceOwner; now: Date },
): Promise<WorkspaceQueueResponse> {
  const { access, userId } = options;
  const scope = await reviewableProviderScope(access, repos.providerSettings);
  const inScope = (provider: string): boolean => scope === null || scope.has(provider);

  const [
    cardDifferences,
    drafts,
    linkedPrintings,
    newPrintings,
    inactiveImages,
    pendingSubmissions,
    costKeywords,
    doneToday,
  ] = await Promise.all([
    repos.workspaceQueue.uncheckedCardDifferences(),
    repos.workspaceQueue.newCardDrafts(),
    repos.workspaceQueue.uncheckedLinkedPrintings(),
    repos.workspaceQueue.newCandidatePrintings(),
    repos.workspaceQueue.inactiveFaceImages(),
    repos.cardSubmissions.pendingReviewQueueRows(),
    repos.keywords.listCostKeywords(),
    repos.workspaceQueue.countAdminEventsSince(userId, startOfUtcDay(options.now)),
  ]);

  const submissions = pendingSubmissions.filter((row) => inScope(row.provider));
  const slugRows = await repos.candidateCards.cardSlugsByNormNames([
    ...new Set(submissions.map((row) => row.normName)),
  ]);
  const slugByNormName = new Map(slugRows.map((row) => [row.normName, row.slug]));

  let entries = buildWorkspaceQueueEntries({
    cardDifferences: cardDifferences.filter((row) => inScope(row.provider)),
    drafts: drafts.filter((row) => inScope(row.provider)),
    linkedPrintings: linkedPrintings.filter((row) => inScope(row.provider)),
    newPrintings: newPrintings.filter((row) => inScope(row.provider)),
    inactiveImages,
    submissions: submissions.map((row) => ({
      id: row.id,
      provider: row.provider,
      cardName: row.cardName,
      candidateCardId: row.candidateCardId,
      cardSlug: slugByNormName.get(row.normName) ?? null,
      proposedDiff: row.proposedDiff,
      createdAt: row.createdAt,
    })),
    costKeywords,
  });

  if (isDeskOnly(access)) {
    const { promoIds, createdIds } = await deskPrintingScope(repos, userId);
    const allowed = new Set([...promoIds, ...createdIds]);
    entries = entries.filter((entry) => deskVisible(entry, allowed));
  }

  return toWorkspaceQueueResponse(
    entries.map((entry) => entry.item),
    doneToday,
    options.owner,
  );
}
