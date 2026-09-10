import type {
  ReviewQueueItem,
  ReviewQueueResponse,
} from "@openrift/shared/contracts/admin/catalog-review";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";

import type { candidateCardsRepo } from "../repositories/candidate-cards.js";
import type { cardSubmissionsRepo } from "../repositories/card-submissions.js";

type CandidateCardsRepo = ReturnType<typeof candidateCardsRepo>;
type CardSubmissionsRepo = ReturnType<typeof cardSubmissionsRepo>;

export interface ReviewQueueRepos {
  candidateCards: CandidateCardsRepo;
  cardSubmissions: CardSubmissionsRepo;
}

export async function buildReviewQueue(
  repos: ReviewQueueRepos,
  scope: Set<string> | null,
): Promise<ReviewQueueResponse> {
  const [pendingRows, groupRows] = await Promise.all([
    repos.cardSubmissions.pendingReviewQueueRows(),
    repos.candidateCards.listSourceReviewGroups(USER_SUBMISSION_PROVIDER),
  ]);

  const inScope = (provider: string): boolean => scope === null || scope.has(provider);
  const pending = pendingRows.filter((row) => inScope(row.provider));
  const groups = groupRows.filter((row) => inScope(row.provider));

  const normNames = [
    ...new Set([...pending.map((row) => row.normName), ...groups.map((row) => row.normName)]),
  ];
  const slugRows = await repos.candidateCards.cardSlugsByNormNames(normNames);
  const slugByNormName = new Map(slugRows.map((row) => [row.normName, row.slug]));

  const contributorItems: ReviewQueueItem[] = pending.map((row) => ({
    id: row.id,
    kind: row.kind,
    provider: row.provider,
    isContributor: true,
    submitterName: row.submitterName,
    cardName: row.cardName,
    normName: row.normName,
    cardSlug: slugByNormName.get(row.normName) ?? null,
    candidateCardId: row.candidateCardId,
    note: row.note,
    changedFields: row.proposedDiff.length,
    uncheckedPrintings: row.uncheckedPrintings,
    newPrintings: row.newPrintings,
    createdAt: row.createdAt.toISOString(),
  }));

  const sourceItems: ReviewQueueItem[] = groups.map((row) => ({
    id: `${row.provider}::${row.normName}`,
    kind: "source",
    provider: row.provider,
    isContributor: false,
    submitterName: null,
    cardName: row.cardName,
    normName: row.normName,
    cardSlug: slugByNormName.get(row.normName) ?? null,
    candidateCardId: row.candidateCardId,
    note: null,
    changedFields: row.uncheckedCards,
    uncheckedPrintings: row.uncheckedPrintings,
    newPrintings: row.newPrintings,
    createdAt: row.createdAt.toISOString(),
  }));

  const items = [...contributorItems, ...sourceItems].toSorted((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  return {
    items,
    counts: {
      open: items.length,
      contributors: contributorItems.length,
      sources: sourceItems.length,
    },
  };
}
