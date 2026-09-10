import type {
  CatalogCardListResponse,
  CatalogCardRow,
} from "@openrift/shared/contracts/admin/catalog-review";

import type { candidateCardsRepo } from "../repositories/candidate-cards.js";

type CandidateCardsRepo = ReturnType<typeof candidateCardsRepo>;

export interface CatalogCardListRepos {
  candidateCards: CandidateCardsRepo;
}

export async function buildCatalogCardList(
  repos: CatalogCardListRepos,
  scope: Set<string> | null,
): Promise<CatalogCardListResponse> {
  const dbRows = await repos.candidateCards.listCatalogCardRows(scope === null ? null : [...scope]);

  const rows: CatalogCardRow[] = dbRows.map((row) => ({
    cardSlug: row.cardSlug,
    name: row.name,
    normName: row.normName,
    firstSetSlug: row.firstSetSlug,
    firstSetName: row.firstSetName,
    setSlugs: row.setSlugs,
    shortCodes: row.shortCodes,
    printingCount: row.printingCount,
    printingsWithoutImage: row.printingsWithoutImage,
    proposals: row.proposals,
    newPrintings: row.newPrintings,
    uncheckedTrustedProviders: row.uncheckedTrustedProviders,
    needsAttention:
      row.proposals > 0 ||
      row.newPrintings > 0 ||
      row.uncheckedTrustedProviders.length > 0 ||
      row.printingsWithoutImage > 0,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return {
    rows,
    counts: {
      all: rows.length,
      needsAttention: rows.filter((row) => row.needsAttention).length,
      drafts: rows.filter((row) => row.cardSlug === null).length,
    },
  };
}
