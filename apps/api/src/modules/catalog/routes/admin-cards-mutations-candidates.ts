import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { JOB_KIND } from "@openrift/shared/job-run-kinds";
import { implement } from "@orpc/server";
import type { Updateable } from "kysely";

import type { CandidatePrintingsTable } from "../../../db/tables/candidates.js";
import { badRequest } from "../../../errors.js";
import { assertExisted, assertFound, assertUpdated } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import {
  assertCandidatePrintingsInScope,
  reviewableProviderScope,
} from "../../candidates/lib/card-review-scope.js";
import { resolveCheckedSubmissions } from "../../candidates/services/card-submission-outcomes.js";
import {
  checkCardCandidates,
  recordCandidateChecks,
} from "../../candidates/services/check-card-candidates.js";
import { ingestCandidates } from "../../candidates/services/ingest-candidates.js";
import {
  relinkCandidatePrintings,
  reresolveEditedCandidateLink,
} from "../../candidates/services/relink-candidates.js";
import { requireScheduler } from "../../system/services/job-scheduler.js";
import { recordAdminEvent, recordAdminEvents } from "../../system/services/record-admin-event.js";

const os = implement(adminCardMutationsContract).$context<ApiContext>().use(requireAuthedUser);

async function settleCheckedSubmissions(
  context: ApiContext,
  args: { candidateCardIds: string[]; adminUserId: string; now: Date },
): Promise<void> {
  const acceptedIds = await resolveCheckedSubmissions(context.repos, { ...args, io: context.io });
  for (const submissionId of acceptedIds) {
    void context.services.notifySubmitterOfCardAcceptance(context.repos, submissionId);
  }
}

function checkContext(context: ApiContext & { userId: string }) {
  return {
    repos: context.repos,
    transact: context.transact,
    io: context.io,
    userId: context.userId,
    notifySubmitter: (submissionId: string) => {
      void context.services.notifySubmitterOfCardAcceptance(context.repos, submissionId);
    },
  };
}

function recordDismissal(
  context: ApiContext & { userId: string },
  action: "dismiss-value" | "restore-value",
  input: { kind: "card" | "printing"; candidateId: string; field: string; value?: unknown },
): Promise<void> {
  const prefix = input.kind === "card" ? "candidate-card" : "candidate-printing";
  return recordAdminEvents(context.repos, context.userId, () =>
    Promise.resolve([
      {
        action: `${prefix}.${action}` as const,
        entityType: prefix,
        entityId: input.candidateId,
        ...(action === "dismiss-value"
          ? { newValues: { field: input.field, value: input.value ?? null } }
          : { oldValues: { field: input.field } }),
      },
    ]),
  );
}

export const adminCardMutationsCandidatesRouter = {
  checkCandidateCard: os.checkCandidateCard.handler(async ({ input, context }): Promise<void> => {
    const { candidateCards } = context.repos;
    const result = await candidateCards.checkCandidateCard(input.candidateCardId);
    assertUpdated(result, "Candidate card not found");

    await settleCheckedSubmissions(context, {
      candidateCardIds: [input.candidateCardId],
      adminUserId: context.userId,
      now: new Date(),
    });
    await recordCandidateChecks(context.repos, context.userId, "candidate-card.check", {
      ids: [input.candidateCardId],
    });
  }),

  uncheckCandidateCard: os.uncheckCandidateCard.handler(
    async ({ input, context }): Promise<void> => {
      const { candidateCards } = context.repos;
      const result = await candidateCards.uncheckCandidateCard(input.candidateCardId);
      assertUpdated(result, "Candidate card not found");
      await recordCandidateChecks(context.repos, context.userId, "candidate-card.uncheck", {
        ids: [input.candidateCardId],
      });
    },
  ),

  checkAllCandidatePrintings: os.checkAllCandidatePrintings.handler(async ({ input, context }) => {
    const { candidateCards } = context.repos;
    const { updated, ids, candidateCardIds } = await candidateCards.checkAllCandidatePrintings(
      input.printingId,
      input.extraIds,
    );

    await settleCheckedSubmissions(context, {
      candidateCardIds,
      adminUserId: context.userId,
      now: new Date(),
    });
    await recordCandidateChecks(context.repos, context.userId, "candidate-printing.check", {
      ids,
    });
    return { updated };
  }),

  checkCandidatePrinting: os.checkCandidatePrinting.handler(
    async ({ input, context }): Promise<void> => {
      const { candidateCards } = context.repos;
      const result = await candidateCards.checkCandidatePrinting(input.id);
      assertFound(result, "Candidate printing not found");

      await settleCheckedSubmissions(context, {
        candidateCardIds: [result.candidateCardId],
        adminUserId: context.userId,
        now: new Date(),
      });
      await recordCandidateChecks(context.repos, context.userId, "candidate-printing.check", {
        ids: [input.id],
      });
    },
  ),

  uncheckCandidatePrinting: os.uncheckCandidatePrinting.handler(
    async ({ input, context }): Promise<void> => {
      const { candidateCards } = context.repos;
      const result = await candidateCards.uncheckCandidatePrinting(input.id);
      assertUpdated(result, "Candidate printing not found");
      await recordCandidateChecks(context.repos, context.userId, "candidate-printing.uncheck", {
        ids: [input.id],
      });
    },
  ),

  listDismissedCandidateValues: os.listDismissedCandidateValues.handler(async ({ context }) => ({
    items: await context.repos.candidateCards.listDismissedValues(),
  })),

  dismissCandidateValue: os.dismissCandidateValue.handler(
    async ({ input, context, errors }): Promise<void> => {
      const found = await context.repos.candidateCards.dismissCandidateValue(
        input.kind,
        input.candidateId,
        input.field,
        input.value,
      );
      if (!found) {
        throw errors.NOT_FOUND();
      }
      await recordDismissal(context, "dismiss-value", input);
    },
  ),

  restoreCandidateValue: os.restoreCandidateValue.handler(
    async ({ input, context, errors }): Promise<void> => {
      const found = await context.repos.candidateCards.restoreCandidateValue(
        input.kind,
        input.candidateId,
        input.field,
      );
      if (!found) {
        throw errors.NOT_FOUND();
      }
      await recordDismissal(context, "restore-value", input);
    },
  ),

  uncheckCandidatePrintings: os.uncheckCandidatePrintings.handler(
    async ({ input, context, errors }) => {
      const ids = [...new Set(input.candidatePrintingIds)];
      const updated = await context.transact(async (trx) => {
        const count = await trx.candidateCards.uncheckCandidatePrintings(ids);
        if (count !== ids.length) {
          throw errors.NOT_FOUND();
        }
        return count;
      });
      await recordCandidateChecks(context.repos, context.userId, "candidate-printing.uncheck", {
        ids,
      });
      return { updated };
    },
  ),

  checkAllForCard: os.checkAllForCard.handler(async ({ input, context }) => {
    const result = await checkCardCandidates(checkContext(context), {
      cardId: input.cardId,
      candidateCardIds: input.candidateCardIds,
    });
    return { updated: result.cardsUpdated, candidateCardIds: result.candidateCardIds };
  }),

  checkPass: os.checkPass.handler(async ({ input, context }) => {
    const { candidateCards } = context.repos;
    const sources = [
      ...(await candidateCards.providersForCandidateCards(input.candidateCardIds)),
      ...(await candidateCards.providersForCandidatePrintings(input.candidatePrintingIds)),
    ];
    if (sources.some((source) => source.provider === USER_SUBMISSION_PROVIDER)) {
      throw badRequest("A contribution is settled by its own decision, not by dismissing.");
    }
    const result = await checkCardCandidates(checkContext(context), input);
    return { cardsUpdated: result.cardsUpdated, printingsUpdated: result.printingsUpdated };
  }),

  uncheckCandidateCards: os.uncheckCandidateCards.handler(async ({ input, context, errors }) => {
    const ids = [...new Set(input.candidateCardIds)];
    const updated = await context.transact(async (trx) => {
      const count = await trx.candidateCards.uncheckCandidateCards(ids);
      if (count !== ids.length) {
        throw errors.NOT_FOUND();
      }
      return count;
    });
    await recordCandidateChecks(context.repos, context.userId, "candidate-card.uncheck", { ids });
    return { updated };
  }),

  patchCandidatePrinting: os.patchCandidatePrinting.handler(
    async ({ input, context, errors }): Promise<void> => {
      const { candidateCards, providerSettings } = context.repos;
      const { id, ...body } = input;

      const scope = await reviewableProviderScope(context.adminAccess, providerSettings);
      await assertCandidatePrintingsInScope(candidateCards, [id], scope);

      // Zod already restricts `body` to the writable-column allowlist for candidate_printings.
      const updates: Updateable<CandidatePrintingsTable> = { ...body };

      if (Object.keys(updates).length === 0) {
        throw errors.BAD_REQUEST({ message: "No valid fields to update" });
      }

      const before = await candidateCards.getCandidatePrintingById(id);

      await context.transact(async (trx) => {
        const result = await trx.candidateCards.patchCandidatePrinting(id, updates);
        assertUpdated(result, "Candidate printing not found");
        if (before) {
          await reresolveEditedCandidateLink(trx, id, before);
        }
      });

      await recordAdminEvent(context.repos, context.userId, {
        action: "candidate-printing.patch",
        entityType: "candidate-printing",
        entityId: id,
        entityLabel: before?.shortCode ?? null,
        oldValues: before
          ? Object.fromEntries(
              Object.keys(updates).map((k) => [k, (before as Record<string, unknown>)[k]]),
            )
          : null,
        newValues: updates,
      });
    },
  ),

  deleteCandidatePrinting: os.deleteCandidatePrinting.handler(
    async ({ input, context }): Promise<void> => {
      const { candidateCards } = context.repos;
      const before = await candidateCards.getCandidatePrintingById(input.id);
      const deleted = await candidateCards.deleteCandidatePrinting(input.id);
      assertExisted(deleted, "Candidate printing not found");

      await recordAdminEvent(context.repos, context.userId, {
        action: "candidate-printing.delete",
        entityType: "candidate-printing",
        entityId: input.id,
        entityLabel: before?.shortCode ?? null,
        oldValues: before
          ? {
              shortCode: before.shortCode,
              setId: before.setId,
              rarity: before.rarity,
              finish: before.finish,
              artVariant: before.artVariant,
              externalId: before.externalId,
            }
          : null,
      });
    },
  ),

  copyCandidatePrinting: os.copyCandidatePrinting.handler(
    async ({ input, context }): Promise<void> => {
      const { catalogMutations: mut, candidateCards } = context.repos;
      const { id, printingId } = input;
      const ps = await candidateCards.getCandidatePrintingById(id);
      assertFound(ps, "Candidate printing not found");

      const target = await mut.getPrintingDifferentiatorsById(printingId, ps.shortCode);
      assertFound(target, "Target printing not found");

      await candidateCards.copyCandidatePrinting(ps, target);

      await recordAdminEvent(context.repos, context.userId, {
        action: "candidate-printing.copy",
        entityType: "candidate-printing",
        entityId: id,
        entityLabel: ps.shortCode,
        newValues: { targetPrintingId: printingId },
      });
    },
  ),

  linkCandidatePrintings: os.linkCandidatePrintings.handler(
    async ({ input, context, errors }): Promise<void> => {
      const { candidateCards } = context.repos;
      const { candidatePrintingIds, printingId } = input;

      if (!Array.isArray(candidatePrintingIds) || candidatePrintingIds.length === 0) {
        throw errors.BAD_REQUEST({ message: "candidatePrintingIds[] required" });
      }

      await candidateCards.linkCandidatePrintings(candidatePrintingIds, printingId);

      // Persist or remove link overrides so links survive delete + re-upload
      await (printingId
        ? candidateCards.upsertPrintingLinkOverrides(candidatePrintingIds, printingId)
        : candidateCards.removePrintingLinkOverrides(candidatePrintingIds));

      await recordAdminEvent(context.repos, context.userId, {
        action: "candidate-printing.link",
        entityType: "candidate-printing",
        entityId: printingId ?? null,
        newValues: { candidatePrintingIds, printingId: printingId ?? null },
      });
    },
  ),

  relinkCandidatePrintings: os.relinkCandidatePrintings.handler(async ({ context }) => {
    const result = await relinkCandidatePrintings(context.repos);

    await recordAdminEvent(context.repos, context.userId, {
      action: "candidate-printing.relink",
      entityType: "candidate-printing",
      newValues: { examined: result.examined, linked: result.linked },
    });

    return result;
  }),

  checkMatchingCandidates: os.checkMatchingCandidates.handler(async ({ context }) => {
    const started = await requireScheduler(context.scheduler).runNow(JOB_KIND.checkMatching);

    if (started.status === "running") {
      await recordAdminEvent(context.repos, context.userId, {
        action: "candidate-card.check-matching",
        entityType: "candidate-card",
        newValues: { runId: started.runId },
      });
    }

    return started;
  }),

  checkByProvider: os.checkByProvider.handler(async ({ input, context, errors }) => {
    const { candidateCards } = context.repos;
    const provider = input.provider;
    if (!provider.trim()) {
      throw errors.BAD_REQUEST({ message: "Provider name is required" });
    }
    const now = new Date();
    const result = await candidateCards.checkByProvider(provider.trim(), now);

    // checkByProvider returns a count, not ids; fetch affected submissions from the ledger.
    const pending = await context.repos.cardSubmissions.pendingByProvider(provider.trim());
    await settleCheckedSubmissions(context, {
      candidateCardIds: pending
        .map((submission) => submission.candidateCardId)
        .filter((id): id is string => id !== null),
      adminUserId: context.userId,
      now,
    });
    return result;
  }),

  deleteByProvider: os.deleteByProvider.handler(async ({ input, context, errors }) => {
    const provider = input.provider.trim();
    if (!provider) {
      throw errors.BAD_REQUEST({ message: "Provider name is required" });
    }
    const deleted = await context.transact(async (repos) => {
      const count = await repos.candidateCards.deleteByProvider(provider);
      await repos.providerSettings.remove(provider);
      return count;
    });

    await recordAdminEvent(context.repos, context.userId, {
      action: "provider.delete-candidates",
      entityType: "provider",
      entityId: provider,
      entityLabel: provider,
      newValues: { deleted },
    });

    return { provider, deleted };
  }),

  upload: os.upload.handler(async ({ input, context }) => {
    const { provider, candidates: cards } = input;

    const result = await ingestCandidates(context.transact, provider.trim(), cards);

    // Counts only — the per-card detail arrays are unbounded.
    await recordAdminEvent(context.repos, context.userId, {
      action: "candidates.upload",
      entityType: "upload",
      entityId: provider.trim(),
      entityLabel: provider.trim(),
      newValues: {
        newCards: result.newCards,
        removedCards: result.removedCards,
        updates: result.updates,
        unchanged: result.unchanged,
        newPrintings: result.newPrintings,
        removedPrintings: result.removedPrintings,
        printingUpdates: result.printingUpdates,
        printingsUnchanged: result.printingsUnchanged,
        errors: result.errors.length,
      },
    });

    return {
      provider: result.provider,
      newCards: result.newCards,
      removedCards: result.removedCards,
      updates: result.updates,
      unchanged: result.unchanged,
      newPrintings: result.newPrintings,
      removedPrintings: result.removedPrintings,
      printingUpdates: result.printingUpdates,
      printingsUnchanged: result.printingsUnchanged,
      errors: result.errors,
      newCardDetails: result.newCardDetails,
      removedCardDetails: result.removedCardDetails,
      updatedCards: result.updatedCards,
      newPrintingDetails: result.newPrintingDetails,
      removedPrintingDetails: result.removedPrintingDetails,
      updatedPrintings: result.updatedPrintings,
    };
  }),
};
