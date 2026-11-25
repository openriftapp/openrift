import { slugifyName } from "@openrift/shared/strings";
import type { CardType, Domain, SuperType } from "@openrift/shared/types/enums";

import type { Repos, Transact } from "../../../deps.js";
import { badRequest, notFound } from "../../../errors.js";
import { badRequestOnUnknownCardEnum, conflictOnUniqueViolation } from "../../../lib/assertions.js";
import type { NewPrinting } from "../../catalog/services/printing-admin.js";
import type { AdminEventInsert } from "../../system/repositories/admin-events.js";
import type { AcceptedCandidateGroup } from "./accept-candidate-printings.js";
import { acceptCandidateGroups } from "./accept-candidate-printings.js";
import { relinkCandidatePrintings } from "./relink-candidates.js";

interface FavoriteNewCardResult {
  cardSlug: string;
  printingsCreated: number;
  skipped: { shortCode: string; reason: string }[];
  accepted: AcceptedCandidateGroup[];
  checkedCandidateCardIds: string[];
}

export async function acceptFavoriteNewCard(
  transact: Transact,
  repos: Pick<Repos, "candidateCards" | "catalogMutations">,
  normalizedName: string,
  favoriteProviders: ReadonlySet<string>,
  created: NewPrinting[],
): Promise<FavoriteNewCardResult> {
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
      await relinkCandidatePrintings(trxRepos, { normName: normalizedName });
    });
  } else {
    const cardFields = {
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
    };
    cardId = await conflictOnUniqueViolation(
      "uq_cards_slug",
      "A card with this slug already exists",
      () =>
        badRequestOnUnknownCardEnum(cardFields, () =>
          transact((trxRepos) =>
            trxRepos.catalogMutations.acceptNewCardFromSources(cardFields, normalizedName),
          ),
        ),
    );
  }

  const candidates = await repos.candidateCards.acceptableCandidatePrintings(
    favoriteCandidates.map((cc) => cc.id),
  );
  const accepted = await acceptCandidateGroups(transact, cardId, candidates);
  created.push(...accepted.created);

  const favoriteIds = favoriteCandidates.map((cc) => cc.id);
  const checked = await repos.candidateCards.checkCandidateCardsByIds(favoriteIds, new Date());

  return {
    cardSlug,
    printingsCreated: accepted.created.length,
    skipped: accepted.skipped,
    accepted: accepted.accepted,
    checkedCandidateCardIds: checked > 0 ? favoriteIds : [],
  };
}

export function favoriteAcceptEvents(
  result: FavoriteNewCardResult,
  normalizedName: string,
): Omit<AdminEventInsert, "actorUserId">[] {
  return [
    {
      action: "card.accept-favorites",
      entityType: "card",
      entityId: result.cardSlug,
      entityLabel: normalizedName,
      cardSlug: result.cardSlug,
      newValues: {
        cardSlug: result.cardSlug,
        printingsCreated: result.printingsCreated,
        skipped: result.skipped,
      },
    },
    ...result.accepted.map((entry) => ({
      action: "printing.accept" as const,
      entityType: "printing" as const,
      entityId: entry.printing.printingId,
      entityLabel: entry.fields.shortCode,
      cardSlug: result.cardSlug,
      newValues: { printingFields: entry.fields, candidatePrintingIds: entry.candidatePrintingIds },
    })),
    ...(result.checkedCandidateCardIds.length === 0
      ? []
      : [
          {
            action: "candidate-card.check" as const,
            entityType: "candidate-card" as const,
            entityId: null,
            cardSlug: result.cardSlug,
            newValues: { candidateCardIds: result.checkedCandidateCardIds },
          },
        ]),
  ];
}
