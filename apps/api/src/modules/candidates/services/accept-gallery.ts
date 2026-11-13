import { slugifyName } from "@openrift/shared/strings";
import type { CardType, Domain, SuperType } from "@openrift/shared/types/enums";

import type { Repos, Transact } from "../../../deps.js";
import { badRequest, notFound } from "../../../errors.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";
import { acceptCandidateGroups } from "./accept-candidate-printings.js";
import { relinkCandidatePrintings } from "./relink-candidates.js";

export async function acceptFavoriteNewCard(
  transact: Transact,
  repos: Pick<Repos, "candidateCards" | "catalogMutations" | "ingest">,
  normalizedName: string,
  favoriteProviders: Set<string>,
  created: NewPrinting[],
): Promise<{
  cardSlug: string;
  printingsCreated: number;
  skipped: { shortCode: string; reason: string }[];
}> {
  const mut = repos.catalogMutations;

  const allCandidates = await repos.candidateCards.candidateCardsByNormName(normalizedName);
  const favoriteCandidates = allCandidates.filter((cc) => favoriteProviders.has(cc.provider));

  const [primaryCandidate] = favoriteCandidates;

  if (!primaryCandidate) {
    throw notFound("No favorite-provider source found for this card");
  }
  if (primaryCandidate.types.length === 0) {
    throw badRequest("The favorite-provider source has no card type");
  }

  const cardSlug = slugifyName(primaryCandidate.name);

  const existing = await mut.getCardIdBySlug(cardSlug);
  let cardId: string;
  if (existing) {
    cardId = existing.id;
    await transact(async (trxRepos) => {
      await trxRepos.catalogMutations.createNameAliases(normalizedName, existing.id);
    });
    await relinkCandidatePrintings(repos);
  } else {
    cardId = await transact((trxRepos) =>
      trxRepos.catalogMutations.acceptNewCardFromSources(
        {
          id: cardSlug,
          name: primaryCandidate.name,
          types: primaryCandidate.types as CardType[],
          superTypes: (primaryCandidate.superTypes ?? []) as SuperType[],
          domains: (primaryCandidate.domains ?? []) as Domain[],
          might: primaryCandidate.might,
          energy: primaryCandidate.energy,
          power: primaryCandidate.power,
          mightBonus: primaryCandidate.mightBonus,
          tags: primaryCandidate.tags ?? [],
        },
        normalizedName,
      ),
    );
  }

  const candidates = await repos.candidateCards.acceptableCandidatePrintings(
    favoriteCandidates.map((cc) => cc.id),
  );
  const accepted = await acceptCandidateGroups(transact, cardId, candidates);
  created.push(...accepted.created);

  for (const cc of favoriteCandidates) {
    await repos.candidateCards.checkCandidateCard(cc.id);
  }

  return {
    cardSlug,
    printingsCreated: accepted.created.length,
    skipped: accepted.skipped,
  };
}
