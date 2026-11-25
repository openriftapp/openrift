import type { Repos, Transact } from "../../../deps.js";
import { assertFound } from "../../../lib/assertions.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";
import { trustedPrintingGroups } from "../lib/workspace-batch.js";
import { acceptCandidateGroup } from "./accept-candidate-printings.js";
import {
  loadPrintingRefs,
  markAcceptedCandidateCardsChecked,
  trustedPrintingRefusals,
} from "./trusted-accept-checks.js";

export async function acceptFavoritePrintingsForCard(
  transact: Transact,
  repos: Pick<
    Repos,
    | "candidateCards"
    | "catalogMutations"
    | "distributionChannels"
    | "enums"
    | "keywords"
    | "sets"
    | "workspaceBatch"
  >,
  cardSlug: string,
  favoriteProviders: Set<string>,
  created: NewPrinting[],
): Promise<{
  printingsCreated: number;
  skipped: { shortCode: string; reason: string }[];
  createdPrintingIds: string[];
  checkedCandidateCardIds: string[];
}> {
  const mut = repos.catalogMutations;

  const card = await mut.getCardBySlug(cardSlug);
  assertFound(card, `Card not found: ${cardSlug}`);

  const keys = await repos.candidateCards.cardNameKeys(card.id);
  const allCandidates =
    keys.length > 0 ? await repos.candidateCards.candidateCardsForDetail(keys) : [];
  const favoriteCandidates = allCandidates.filter((cc) => favoriteProviders.has(cc.provider));
  if (favoriteCandidates.length === 0) {
    return {
      printingsCreated: 0,
      skipped: [],
      createdPrintingIds: [],
      checkedCandidateCardIds: [],
    };
  }

  const candidates = await repos.candidateCards.acceptableCandidatePrintings(
    favoriteCandidates.map((cc) => cc.id),
  );
  if (candidates.length === 0) {
    return {
      printingsCreated: 0,
      skipped: [],
      createdPrintingIds: [],
      checkedCandidateCardIds: [],
    };
  }
  const groups = trustedPrintingGroups(
    candidates.map((cp) => ({ id: cp.id, cardId: card.id, cardSlug })),
    candidates,
  );
  const [known, probes] = await Promise.all([
    loadPrintingRefs(
      repos,
      groups.map((group) => group.first),
    ),
    repos.workspaceBatch.frontPrintingProbes([card.id]),
  ]);

  const accepted: NewPrinting[] = [];
  const acceptedGroups: typeof groups = [];
  const skipped: { shortCode: string; reason: string }[] = [];
  const refusals = await trustedPrintingRefusals(repos, groups, known, probes);
  for (const [index, group] of groups.entries()) {
    const refusal = refusals[index] ?? null;
    const outcome =
      refusal === null
        ? await acceptCandidateGroup(transact, card.id, group.candidates)
        : { reason: refusal };
    if ("printing" in outcome) {
      created.push(outcome.printing);
      accepted.push(outcome.printing);
      acceptedGroups.push(group);
    } else {
      skipped.push({ shortCode: group.first.shortCode, reason: outcome.reason });
    }
  }

  const checkedCandidateCardIds = await markAcceptedCandidateCardsChecked(repos, acceptedGroups);

  return {
    printingsCreated: accepted.length,
    skipped,
    createdPrintingIds: accepted.map((printing) => printing.printingId),
    checkedCandidateCardIds,
  };
}
