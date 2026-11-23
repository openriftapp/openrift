import type {
  ReviewCardsResponse,
  WorkspaceOwner,
  WorkspaceQueueResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";

import type { Repos } from "../../../deps.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { UnassignedListings } from "../../marketplace/lib/unassigned-listings.js";
import { reviewableProviderScope } from "../lib/card-review-scope.js";
import { toReviewCards } from "../lib/review-cards.js";
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
  return (
    item.owner === "face" &&
    (item.reason === "new-image" || item.reason === "image-rehost-failed") &&
    touchesAllowed
  );
}

export async function buildWorkspaceQueue(
  repos: WorkspaceRepos,
  options: {
    access: AdminAccess | null;
    userId: string;
    owner?: WorkspaceOwner;
    loadListings?: () => Promise<UnassignedListings>;
  },
): Promise<WorkspaceQueueResponse> {
  const { access, userId } = options;
  const [
    scope,
    deskScope,
    listings,
    cardDifferences,
    drafts,
    linkedPrintings,
    newPrintings,
    inactiveImages,
    pendingSubmissions,
    costKeywords,
  ] = await Promise.all([
    reviewableProviderScope(access, repos.providerSettings),
    isDeskOnly(access) ? deskPrintingScope(repos, userId) : undefined,
    access?.isAdmin === true ? options.loadListings?.() : undefined,
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
    listings,
  });

  if (deskScope !== undefined) {
    const { promoIds, createdIds } = deskScope;
    const allowed = new Set([...promoIds, ...createdIds]);
    entries = entries.filter((entry) => deskVisible(entry, allowed));
  }

  return toWorkspaceQueueResponse(
    entries.map((entry) => entry.item),
    options.owner,
  );
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
  const { items } = await buildWorkspaceQueue(repos, options);
  return { cards: toReviewCards(items) };
}
