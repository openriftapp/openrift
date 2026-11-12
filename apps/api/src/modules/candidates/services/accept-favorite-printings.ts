import { ERROR_CODES } from "@openrift/shared/error-codes";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";
import { acceptCandidateGroups } from "./accept-candidate-printings.js";

export async function acceptFavoritePrintingsForCard(
  transact: Transact,
  repos: Pick<Repos, "candidateCards" | "catalogMutations">,
  cardSlug: string,
  favoriteProviders: Set<string>,
  created: NewPrinting[],
): Promise<{
  printingsCreated: number;
  skipped: { shortCode: string; reason: string }[];
  createdPrintingIds: string[];
}> {
  const mut = repos.catalogMutations;

  const card = await mut.getCardBySlug(cardSlug);
  assertFound(card, `Card not found: ${cardSlug}`);

  const aliases = await mut.getCardAliases(card.id);
  if (aliases.length === 0) {
    throw new AppError(500, ERROR_CODES.MISSING_ALIAS, `Card "${cardSlug}" has no name aliases`);
  }
  const allCandidates = await repos.candidateCards.candidateCardsForDetail(
    aliases.map((a) => a.normName),
  );
  const favoriteCandidates = allCandidates.filter((cc) => favoriteProviders.has(cc.provider));
  if (favoriteCandidates.length === 0) {
    return { printingsCreated: 0, skipped: [], createdPrintingIds: [] };
  }

  const candidates = await repos.candidateCards.acceptableCandidatePrintings(
    favoriteCandidates.map((cc) => cc.id),
  );
  if (candidates.length === 0) {
    return { printingsCreated: 0, skipped: [], createdPrintingIds: [] };
  }
  const accepted = await acceptCandidateGroups(transact, card.id, candidates);
  created.push(...accepted.created);

  for (const cc of favoriteCandidates) {
    await repos.candidateCards.checkCandidateCard(cc.id);
  }

  return {
    printingsCreated: accepted.created.length,
    skipped: accepted.skipped,
    createdPrintingIds: accepted.created.map((printing) => printing.printingId),
  };
}
