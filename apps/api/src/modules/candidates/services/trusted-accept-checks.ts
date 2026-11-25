import type { Selectable } from "kysely";

import type { CandidatePrintingsTable } from "../../../db/tables/candidates.js";
import type { Repos } from "../../../deps.js";
import { badRequest } from "../../../errors.js";
import type { KnownPrintingRefs } from "../../catalog/lib/printing-refs.js";
import {
  describeUnknownRefs,
  loadKnownPrintingRefs,
  unknownPrintingRefs,
} from "../../catalog/lib/printing-refs.js";
import { facePrintedFieldConflicts } from "../../catalog/services/printing-admin.js";
import type { CandidateAcceptFields } from "../lib/candidate-printing-accept.js";
import { acceptFieldsFromCandidate } from "../lib/candidate-printing-accept.js";
import type {
  IneligibleTrustedCard,
  TrustedCardDraft,
  TrustedPrintingGroup,
} from "../lib/workspace-batch.js";
import { eligibleTrustedCards, findDuplicatePrinting } from "../lib/workspace-batch.js";
import type { PrintingProbeRow, TrustedDraftRow } from "../repositories/workspace-batch.js";

type CandidatePrintingRow = Selectable<CandidatePrintingsTable>;

type CardCheckRepos = Pick<Repos, "candidateCards" | "enums" | "distributionChannels">;

export function loadPrintingRefs(
  repos: Pick<Repos, "enums" | "distributionChannels">,
  printings: readonly Pick<CandidatePrintingRow, "distributionChannelSlugs">[],
): Promise<KnownPrintingRefs> {
  return loadKnownPrintingRefs(
    repos,
    printings.flatMap((cp) => cp.distributionChannelSlugs),
  );
}

export async function trustedCardEligibility(
  repos: CardCheckRepos,
  drafts: readonly TrustedDraftRow[],
): Promise<{ eligible: TrustedCardDraft[]; ineligible: IneligibleTrustedCard[] }> {
  const [liveCards, printings] = await Promise.all([
    repos.candidateCards.listCardsForSourceList(),
    repos.candidateCards.acceptableCandidatePrintings(drafts.map((draft) => draft.id)),
  ]);
  const known = await loadPrintingRefs(repos, printings);
  return eligibleTrustedCards(drafts, printings, liveCards, known);
}

export async function assertFavoriteNewCardEligible(
  repos: CardCheckRepos,
  normName: string,
  favoriteProviders: ReadonlySet<string>,
): Promise<void> {
  const candidates = await repos.candidateCards.candidateCardsByNormName(normName);
  const drafts = candidates
    .filter((cc) => favoriteProviders.has(cc.provider))
    .map((cc) => ({
      id: cc.id,
      provider: cc.provider,
      normName: cc.normName,
      name: cc.name,
      types: cc.types,
    }));
  if (drafts.length === 0) {
    return;
  }
  const { ineligible } = await trustedCardEligibility(repos, drafts);
  const [refused] = ineligible;
  if (refused) {
    throw badRequest(`Not accepted: ${refused.reason}`);
  }
}

export async function trustedPrintingRefusals(
  repos: Pick<Repos, "catalogMutations" | "sets" | "keywords">,
  groups: readonly TrustedPrintingGroup[],
  known: KnownPrintingRefs,
  probes: readonly PrintingProbeRow[],
): Promise<(string | null)[]> {
  const refusals: (string | null)[] = [];
  const faceChecks: { index: number; cardId: string; printingFields: CandidateAcceptFields }[] = [];
  for (const [index, group] of groups.entries()) {
    const accepted = acceptFieldsFromCandidate(group.first);
    const unknown = accepted.missing ? [] : unknownPrintingRefs(accepted.fields, known);
    const duplicate = findDuplicatePrinting(group, probes);
    if (accepted.missing) {
      refusals.push(`missing: ${accepted.missing.join(", ")}`);
    } else if (unknown.length > 0) {
      refusals.push(describeUnknownRefs(unknown));
    } else if (duplicate) {
      refusals.push(`possible duplicate of ${duplicate.shortCode}`);
    } else {
      refusals.push(null);
      faceChecks.push({ index, cardId: group.cardId, printingFields: accepted.fields });
    }
  }
  const conflicts = await facePrintedFieldConflicts(repos, faceChecks);
  for (const [position, check] of faceChecks.entries()) {
    refusals[check.index] = conflicts[position] ?? null;
  }
  return refusals;
}

export async function markAcceptedCandidateCardsChecked(
  repos: Pick<Repos, "candidateCards">,
  acceptedGroups: readonly {
    candidates: readonly Pick<CandidatePrintingRow, "candidateCardId">[];
  }[],
): Promise<void> {
  const ids = new Set(
    acceptedGroups.flatMap((group) => group.candidates.map((cp) => cp.candidateCardId)),
  );
  if (ids.size > 0) {
    await repos.candidateCards.checkCandidateCardsByIds([...ids], new Date());
  }
}
