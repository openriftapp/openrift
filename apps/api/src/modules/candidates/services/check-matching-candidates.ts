import {
  COMPARABLE_CARD_FIELDS,
  COMPARABLE_PRINTING_FIELDS,
  differingFields,
  hasFieldValue,
} from "@openrift/shared/catalog-field-compare";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { normalizeProvidedPrintingRecord } from "@openrift/shared/printing-value-normalize";

import { createEventLoopYielder } from "../../../lib/event-loop-yield.js";
import { classifyAgainstLive } from "../../../lib/image-fingerprint.js";
import type { keywordsRepo } from "../../catalog/repositories/keywords.js";
import type { candidateCardsRepo } from "../repositories/candidate-cards.js";

type CandidateCardsRepo = ReturnType<typeof candidateCardsRepo>;
type KeywordsRepo = ReturnType<typeof keywordsRepo>;

export const CHECK_MATCHING_PAGE_SIZE = 250;

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
    // oxlint-disable-next-line no-await-in-loop -- hands the event loop back so API requests are served mid-page
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
      differingFields(COMPARABLE_CARD_FIELDS, row.live, row.candidate).length === 0,
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
      const { imageUrl, imageFingerprint, ...candidate } = row.candidate;
      const { imageUrls, imageFingerprints, ...live } = row.live;
      if (
        hasFieldValue(imageUrl) &&
        !imageUrls.includes(imageUrl as string) &&
        classifyAgainstLive(imageFingerprint, imageFingerprints) !== "same"
      ) {
        return false;
      }
      const normalized = normalizeProvidedPrintingRecord(candidate, {
        costKeywords,
        printedTotal: row.printedTotal,
      });
      return differingFields(COMPARABLE_PRINTING_FIELDS, live, normalized).length === 0;
    },
    check: (ids) => candidateCards.checkCandidatePrintingsByIds(ids, now),
    pageSize,
    yieldIfBusy,
  });

  return { cardsChecked, printingsChecked };
}
