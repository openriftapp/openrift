import type {
  CatalogSource,
  CatalogSourcesResponse,
} from "@openrift/shared/contracts/admin/catalog-review";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";

import type { CatalogSourceRow } from "../repositories/candidate-cards-catalog-list.js";
import type { candidateCardsRepo } from "../repositories/candidate-cards.js";
import type { cardSubmissionsRepo } from "../repositories/card-submissions.js";

type CandidateCardsRepo = ReturnType<typeof candidateCardsRepo>;
type CardSubmissionsRepo = ReturnType<typeof cardSubmissionsRepo>;

export interface CatalogSourcesRepos {
  candidateCards: CandidateCardsRepo;
  cardSubmissions: CardSubmissionsRepo;
}

const ZERO_COUNTS = {
  rows: 0,
  printingRows: 0,
  lastUploadedAt: null,
  ignoredCount: 0,
  uncheckedRows: 0,
} satisfies Partial<CatalogSourceRow>;

const EMPTY_SOURCE: Omit<CatalogSourceRow, "provider"> = {
  ...ZERO_COUNTS,
  isHidden: false,
  isFavorite: false,
  helperReviewable: false,
  sortOrder: 0,
};

function toSource(row: CatalogSourceRow, inReview: number): CatalogSource {
  return {
    provider: row.provider,
    kind: row.provider === USER_SUBMISSION_PROVIDER ? "contributors" : "upload",
    rows: row.rows,
    printingRows: row.printingRows,
    inReview,
    isHidden: row.isHidden,
    isFavorite: row.isFavorite,
    helperReviewable: row.helperReviewable,
    sortOrder: row.sortOrder,
    lastUploadedAt: row.lastUploadedAt?.toISOString() ?? null,
    ignoredCount: row.ignoredCount,
    uncheckedRows: row.uncheckedRows,
  };
}

export async function buildCatalogSources(
  repos: CatalogSourcesRepos,
  scope: Set<string> | null,
): Promise<CatalogSourcesResponse> {
  const [sourceRows, pending, groups] = await Promise.all([
    repos.candidateCards.listCatalogSourceRows(),
    repos.cardSubmissions.pendingReviewQueueRows(),
    repos.candidateCards.listSourceReviewGroups(USER_SUBMISSION_PROVIDER),
  ]);

  const inScope = (provider: string): boolean => scope === null || scope.has(provider);

  const inReview = new Map<string, number>();
  for (const item of [...pending, ...groups]) {
    if (inScope(item.provider)) {
      inReview.set(item.provider, (inReview.get(item.provider) ?? 0) + 1);
    }
  }

  const contributorRow = sourceRows.find((row) => row.provider === USER_SUBMISSION_PROVIDER) ?? {
    provider: USER_SUBMISSION_PROVIDER,
    ...EMPTY_SOURCE,
  };
  const contributors = inScope(USER_SUBMISSION_PROVIDER)
    ? contributorRow
    : { ...contributorRow, ...ZERO_COUNTS };

  const rest = sourceRows.filter(
    (row) => row.provider !== USER_SUBMISSION_PROVIDER && inScope(row.provider),
  );

  return {
    sources: [contributors, ...rest].map((row) => toSource(row, inReview.get(row.provider) ?? 0)),
  };
}
