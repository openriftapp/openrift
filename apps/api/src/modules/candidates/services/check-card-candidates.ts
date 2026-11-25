import type { Repos, Transact } from "../../../deps.js";
import { notFound } from "../../../errors.js";
import type { Io } from "../../../io.js";
import { recordAdminEvents } from "../../system/services/record-admin-event.js";
import { resolveCheckedSubmissions } from "./card-submission-outcomes.js";

type CandidateCheckAction =
  | "candidate-card.check"
  | "candidate-card.uncheck"
  | "candidate-printing.check"
  | "candidate-printing.uncheck";

export async function recordCandidateChecks(
  repos: Pick<Repos, "adminEvents">,
  userId: string,
  action: CandidateCheckAction,
  target: { ids: readonly string[]; cardSlug?: string | null },
): Promise<void> {
  if (target.ids.length === 0) {
    return;
  }
  const onCards = action.startsWith("candidate-card.");
  const [only] = target.ids;
  await recordAdminEvents(repos, userId, () =>
    Promise.resolve([
      {
        action,
        entityType: onCards ? "candidate-card" : "candidate-printing",
        entityId: target.ids.length === 1 ? only : null,
        cardSlug: target.cardSlug ?? null,
        newValues: { [onCards ? "candidateCardIds" : "candidatePrintingIds"]: [...target.ids] },
      },
    ]),
  );
}

interface CheckContext {
  repos: Repos;
  transact: Transact;
  io: Io;
  userId: string;
  notifySubmitter: (submissionId: string) => void;
}

interface CheckCardCandidatesResult {
  cardsUpdated: number;
  printingsUpdated: number;
  candidateCardIds: string[];
}

/** One transaction; every listed id must belong to the card. Without `candidateCardIds` every
 *  candidate card of the card is checked. */
export async function checkCardCandidates(
  context: CheckContext,
  input: {
    cardId: string;
    candidateCardIds?: readonly string[];
    candidatePrintingIds?: readonly string[];
  },
): Promise<CheckCardCandidatesResult> {
  const card = await context.repos.catalogMutations.getCardById(input.cardId);
  if (!card) {
    throw notFound("Card not found");
  }
  const normNames = await context.repos.candidateCards.cardNameKeys(card.id);
  const cardIds =
    input.candidateCardIds === undefined ? undefined : [...new Set(input.candidateCardIds)];
  const printingIds = [...new Set(input.candidatePrintingIds)];

  const { cards, printings } = await context.transact(async (trx) => {
    const checkedCards = await trx.candidateCards.checkAllCandidateCards(
      normNames,
      card.id,
      cardIds,
    );
    if (cardIds !== undefined && checkedCards.candidateCardIds.length !== cardIds.length) {
      throw notFound("Candidate card not found");
    }
    const checkedPrintings =
      printingIds.length === 0
        ? { updated: 0, matchedIds: [], candidateCardIds: [] }
        : await trx.candidateCards.checkCandidatePrintingsOfCard(normNames, card.id, printingIds);
    if (checkedPrintings.matchedIds.length !== printingIds.length) {
      throw notFound("Candidate printing not found");
    }
    return { cards: checkedCards, printings: checkedPrintings };
  });

  const candidateCardIds = [...new Set([...cards.candidateCardIds, ...printings.candidateCardIds])];
  const acceptedIds = await resolveCheckedSubmissions(context.repos, {
    candidateCardIds,
    adminUserId: context.userId,
    now: new Date(),
    io: context.io,
  });
  for (const submissionId of acceptedIds) {
    context.notifySubmitter(submissionId);
  }

  await recordCandidateChecks(context.repos, context.userId, "candidate-card.check", {
    ids: cards.candidateCardIds,
    cardSlug: card.slug,
  });
  await recordCandidateChecks(context.repos, context.userId, "candidate-printing.check", {
    ids: printings.matchedIds,
    cardSlug: card.slug,
  });

  return {
    cardsUpdated: cards.updated,
    printingsUpdated: printings.updated,
    candidateCardIds: cards.candidateCardIds,
  };
}
