import type {
  ReviewCardsResponse,
  WorkspaceCandidatePrintingCard,
  WorkspaceQueueItem,
  WorkspaceQueueResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { isUuid } from "@openrift/shared/strings";

import type { Repos } from "../../../deps.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { UnassignedListings } from "../../marketplace/lib/unassigned-listings.js";
import { reviewableProviderScope } from "../lib/card-review-scope.js";
import { toReviewCards } from "../lib/review-cards.js";
import type { DeskRecordScope, WorkspaceQueueEntry } from "../lib/workspace-presenters.js";
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
  | "adminEvents"
>;

export function isDeskOnly(access: AdminAccess | null): boolean {
  return access?.isAdmin !== true && access?.sections.includes("card-review") !== true;
}

/** `undefined` for a caller the desk scope does not limit. */
export async function deskScopeFor(
  repos: Pick<WorkspaceRepos, "workspaceRecords">,
  access: AdminAccess | null,
  userId: string,
): Promise<DeskRecordScope | undefined> {
  if (!isDeskOnly(access)) {
    return undefined;
  }
  const { promoIds, createdIds } = await repos.workspaceRecords.deskScope(userId);
  return { promoIds: new Set(promoIds), createdIds: new Set(createdIds) };
}

function deskVisible(entry: WorkspaceQueueEntry, allowed: ReadonlySet<string>): boolean {
  const { item } = entry;
  const touchesAllowed = entry.printingIds.some((id) => allowed.has(id));
  if (item.owner === "printing") {
    return item.segment === "open" && touchesAllowed;
  }
  return (
    item.owner === "face" &&
    (item.reason === "new-image" || item.reason === "image-rehost-failed") &&
    touchesAllowed
  );
}

function withinDesk(
  entries: WorkspaceQueueEntry[],
  desk: DeskRecordScope | undefined,
): WorkspaceQueueEntry[] {
  if (desk === undefined) {
    return entries;
  }
  const allowed = new Set([...desk.promoIds, ...desk.createdIds]);
  return entries.filter((entry) => deskVisible(entry, allowed));
}

interface QueueOptions {
  access: AdminAccess | null;
  desk: DeskRecordScope | undefined;
}

export async function buildWorkspaceQueue(
  repos: WorkspaceRepos,
  options: QueueOptions,
): Promise<WorkspaceQueueResponse> {
  const [
    scope,
    cardDifferences,
    drafts,
    linkedPrintings,
    newPrintings,
    inactiveImages,
    pendingSubmissions,
    costKeywords,
  ] = await Promise.all([
    reviewableProviderScope(options.access, repos.providerSettings),
    repos.workspaceQueue.uncheckedCardDifferences(),
    repos.workspaceQueue.newCardDrafts(),
    repos.workspaceQueue.uncheckedLinkedPrintings(),
    repos.workspaceQueue.newCandidatePrintings(),
    repos.workspaceQueue.inactiveFaceImages(),
    repos.cardSubmissions.pendingReviewQueueRows(),
    repos.keywords.listCostKeywords(),
  ]);

  const inScope = (provider: string): boolean => scope === null || scope.has(provider);
  const submissions = pendingSubmissions.filter((row) => inScope(row.provider));
  const slugRows = await repos.candidateCards.cardSlugsByNormNames([
    ...new Set(submissions.map((row) => row.normName)),
  ]);
  const slugByNormName = new Map(slugRows.map((row) => [row.normName, row.slug]));

  const entries = buildWorkspaceQueueEntries({
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

  return toWorkspaceQueueResponse(withinDesk(entries, options.desk).map((entry) => entry.item));
}

export async function buildFaceQueueItems(
  repos: Pick<WorkspaceRepos, "workspaceQueue" | "providerSettings" | "keywords">,
  options: QueueOptions,
): Promise<WorkspaceQueueItem[]> {
  const [scope, linkedPrintings, inactiveImages, costKeywords] = await Promise.all([
    reviewableProviderScope(options.access, repos.providerSettings),
    repos.workspaceQueue.uncheckedLinkedPrintings(),
    repos.workspaceQueue.inactiveFaceImages(),
    repos.keywords.listCostKeywords(),
  ]);
  const entries = buildWorkspaceQueueEntries({
    cardDifferences: [],
    drafts: [],
    linkedPrintings: linkedPrintings.filter((row) => scope === null || scope.has(row.provider)),
    newPrintings: [],
    inactiveImages,
    submissions: [],
    costKeywords,
  });
  return withinDesk(entries, options.desk)
    .map((entry) => entry.item)
    .filter((item) => item.owner === "face");
}

/** Desk holders see no new printings, so they always get null. */
export async function candidatePrintingCard(
  repos: Pick<WorkspaceRepos, "workspaceQueue" | "providerSettings">,
  options: { access: AdminAccess | null; candidatePrintingId: string },
): Promise<WorkspaceCandidatePrintingCard> {
  if (isDeskOnly(options.access) || !isUuid(options.candidatePrintingId)) {
    return { cardSlug: null };
  }
  const [scope, row] = await Promise.all([
    reviewableProviderScope(options.access, repos.providerSettings),
    repos.workspaceQueue.newCandidatePrintingCard(options.candidatePrintingId),
  ]);
  if (row === undefined || (scope !== null && !scope.has(row.provider))) {
    return { cardSlug: null };
  }
  return { cardSlug: row.cardSlug };
}

export function buildListingItems(listings: UnassignedListings): WorkspaceQueueResponse {
  const entries = buildWorkspaceQueueEntries({
    cardDifferences: [],
    drafts: [],
    linkedPrintings: [],
    newPrintings: [],
    inactiveImages: [],
    submissions: [],
    costKeywords: [],
    listings,
  });
  return toWorkspaceQueueResponse(entries.map((entry) => entry.item));
}

export async function buildReviewCards(
  repos: WorkspaceRepos,
  options: { access: AdminAccess | null; userId: string },
): Promise<ReviewCardsResponse> {
  const desk = await deskScopeFor(repos, options.access, options.userId);
  const { items } = await buildWorkspaceQueue(repos, { access: options.access, desk });
  return { cards: toReviewCards(items) };
}
