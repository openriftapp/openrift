import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";

import { createEventLoopYielder } from "../../../lib/event-loop-yield.js";
import type { keywordsRepo } from "../../catalog/repositories/keywords.js";
import { cardSourceDifferences, linkedPrintingDifferences } from "../lib/workspace-presenters.js";
import type { candidateCardsRepo } from "../repositories/candidate-cards.js";

type CandidateCardsRepo = ReturnType<typeof candidateCardsRepo>;
type KeywordsRepo = ReturnType<typeof keywordsRepo>;

const CHECK_MATCHING_PAGE_SIZE = 250;

export interface CheckMatchingResult {
  cardsChecked: number;
  printingsChecked: number;
}

interface PagedCheck<Row extends { id: string }> {
  list: (afterId: string | null) => Promise<Row[]>;
  matches: (row: Row) => boolean;
  check: (ids: string[]) => Promise<number>;
  pageSize: number;
  yieldIfBusy: () => Promise<void>;
}

async function checkInPages<Row extends { id: string }>(
  paged: PagedCheck<Row>,
  afterId: string | null = null,
): Promise<number> {
  const rows = await paged.list(afterId);
  const matchingIds: string[] = [];
  for (const row of rows) {
    await paged.yieldIfBusy();
    if (paged.matches(row)) {
      matchingIds.push(row.id);
    }
  }
  const checked = matchingIds.length > 0 ? await paged.check(matchingIds) : 0;
  const last = rows.at(-1);
  if (last === undefined || rows.length < paged.pageSize) {
    return checked;
  }
  return checked + (await checkInPages(paged, last.id));
}

/**
 * Checks every unchecked source row whose provided values all equal the live
 * catalog. A field the source has no value for never counts as a difference,
 * source values compare after the transforms the accept path applies, and an
 * image counts as equal when its fingerprint matches a live front image.
 */
export async function checkMatchingCandidates(
  repos: { candidateCards: CandidateCardsRepo; keywords: KeywordsRepo },
  now: Date,
  pageSize = CHECK_MATCHING_PAGE_SIZE,
): Promise<CheckMatchingResult> {
  const { candidateCards } = repos;
  const costKeywords = await repos.keywords.listCostKeywords();
  const yieldIfBusy = createEventLoopYielder();

  const cardsChecked = await checkInPages({
    list: (afterId) =>
      candidateCards.listUncheckedCandidateCardsWithLive(
        USER_SUBMISSION_PROVIDER,
        afterId,
        pageSize,
      ),
    matches: (row) =>
      row.live !== null &&
      cardSourceDifferences({ candidate: row.candidate, live: row.live }).length === 0,
    check: (ids) => candidateCards.checkCandidateCardsByIds(ids, now),
    pageSize,
    yieldIfBusy,
  });

  const printingsChecked = await checkInPages({
    list: (afterId) =>
      candidateCards.listUncheckedCandidatePrintingsWithLive(
        USER_SUBMISSION_PROVIDER,
        afterId,
        pageSize,
      ),
    matches: (row) => {
      const { faceFields, printingFields, newImage } = linkedPrintingDifferences(row, costKeywords);
      return !newImage && faceFields.length === 0 && printingFields.length === 0;
    },
    check: (ids) => candidateCards.checkCandidatePrintingsByIds(ids, now),
    pageSize,
    yieldIfBusy,
  });

  return { cardsChecked, printingsChecked };
}
