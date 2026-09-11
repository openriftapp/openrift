import {
  COMPARABLE_CARD_FIELDS,
  COMPARABLE_PRINTING_FIELDS,
  differingFields,
  hasFieldValue,
} from "@openrift/shared/catalog-field-compare";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";

import type { candidateCardsRepo } from "../repositories/candidate-cards.js";

type CandidateCardsRepo = ReturnType<typeof candidateCardsRepo>;

export interface CheckMatchingResult {
  cardsChecked: number;
  printingsChecked: number;
}

/**
 * Checks every unchecked source row whose provided values all equal the live
 * catalog. A field the source has no value for never counts as a difference.
 */
export async function checkMatchingCandidates(
  repos: { candidateCards: CandidateCardsRepo },
  now: Date,
): Promise<CheckMatchingResult> {
  const [cards, printings] = await Promise.all([
    repos.candidateCards.listUncheckedCandidateCardsWithLive(USER_SUBMISSION_PROVIDER),
    repos.candidateCards.listUncheckedCandidatePrintingsWithLive(USER_SUBMISSION_PROVIDER),
  ]);

  const matchingCardIds = cards
    .filter(
      (row) =>
        row.live !== null &&
        differingFields(COMPARABLE_CARD_FIELDS, row.live, row.candidate).length === 0,
    )
    .map((row) => row.id);

  const matchingPrintingIds = printings
    .filter((row) => {
      const { imageUrl, ...candidate } = row.candidate;
      const { imageUrls, ...live } = row.live;
      if (hasFieldValue(imageUrl) && !imageUrls.includes(imageUrl as string)) {
        return false;
      }
      return differingFields(COMPARABLE_PRINTING_FIELDS, live, candidate).length === 0;
    })
    .map((row) => row.id);

  const [cardsChecked, printingsChecked] = await Promise.all([
    repos.candidateCards.checkCandidateCardsByIds(matchingCardIds, now),
    repos.candidateCards.checkCandidatePrintingsByIds(matchingPrintingIds, now),
  ]);

  return { cardsChecked, printingsChecked };
}
