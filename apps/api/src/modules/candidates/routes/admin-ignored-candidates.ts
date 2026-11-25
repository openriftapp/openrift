import { adminIgnoredCandidatesContract } from "@openrift/shared/contracts/admin/ignored-candidates";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvent, recordAdminEvents } from "../../system/services/record-admin-event.js";
import {
  rejectIgnoredSubmission,
  reopenUnignoredSubmission,
} from "../services/card-submission-outcomes.js";

const os = implement(adminIgnoredCandidatesContract).$context<ApiContext>().use(requireAuthedUser);

function uniqueSources(
  sources: readonly { provider: string; externalId: string }[],
): { provider: string; externalId: string }[] {
  const byKey = new Map(
    sources.map(({ provider, externalId }) => [
      JSON.stringify([provider, externalId]),
      { provider, externalId },
    ]),
  );
  return [...byKey.values()];
}

export const adminIgnoredCandidatesRouter = {
  list: os.list.handler(async ({ context }) => {
    const { ignoredCandidates, candidateCards } = context.repos;

    const [cards, printings, printingLinks] = await Promise.all([
      ignoredCandidates.listIgnoredCards(),
      ignoredCandidates.listIgnoredPrintings(),
      candidateCards.listPrintingLinkOverrides(),
    ]);

    return {
      cards: cards.map((r) => ({
        id: r.id,
        provider: r.provider,
        externalId: r.externalId,
        createdAt: r.createdAt.toISOString(),
      })),
      printings: printings.map((r) => ({
        id: r.id,
        provider: r.provider,
        externalId: r.externalId,
        finish: r.finish,
        createdAt: r.createdAt.toISOString(),
      })),
      printingLinks: printingLinks.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }),

  ignoreCards: os.ignoreCards.handler(async ({ input, context }): Promise<void> => {
    const sources = uniqueSources(input.sources);
    await context.repos.ignoredCandidates.ignoreCards(sources);

    // For a user submission this rejects it (per-submission external_id makes
    // the key exact); no-ops for scraped providers.
    const now = new Date();
    for (const { provider, externalId } of sources) {
      await rejectIgnoredSubmission(context.repos, {
        provider,
        externalId,
        adminUserId: context.userId,
        now,
        io: context.io,
      });
    }

    await recordAdminEvents(context.repos, context.userId, () =>
      Promise.resolve(
        sources.map(({ provider, externalId }) => ({
          action: "candidate-card.ignore" as const,
          entityType: "candidate-card" as const,
          entityId: `${provider}:${externalId}`,
          newValues: { provider, externalId },
        })),
      ),
    );
  }),

  unignoreCards: os.unignoreCards.handler(async ({ input, context }): Promise<void> => {
    const sources = uniqueSources(input.sources);
    await context.repos.ignoredCandidates.unignoreCards(sources);

    // Undoing the rejection puts the submission back in the queue, so a
    // misclick doesn't leave a contributor looking at a wrong outcome.
    for (const source of sources) {
      await reopenUnignoredSubmission(context.repos, source);
    }

    await recordAdminEvents(context.repos, context.userId, () =>
      Promise.resolve(
        sources.map(({ provider, externalId }) => ({
          action: "candidate-card.unignore" as const,
          entityType: "candidate-card" as const,
          entityId: `${provider}:${externalId}`,
          oldValues: { provider, externalId },
        })),
      ),
    );
  }),

  ignorePrinting: os.ignorePrinting.handler(async ({ input, context }): Promise<void> => {
    const { ignoredCandidates } = context.repos;
    const { provider, externalId, finish } = input;
    await ignoredCandidates.ignorePrinting({ provider, externalId, finish: finish ?? null });

    await recordAdminEvent(context.repos, context.userId, {
      action: "candidate-printing.ignore",
      entityType: "candidate-printing",
      entityId: `${provider}:${externalId}`,
      newValues: { provider, externalId, finish: finish ?? null },
    });
  }),

  unignorePrinting: os.unignorePrinting.handler(async ({ input, context }): Promise<void> => {
    const { ignoredCandidates } = context.repos;
    const { provider, externalId, finish } = input;
    await ignoredCandidates.unignorePrinting(provider, externalId, finish);

    await recordAdminEvent(context.repos, context.userId, {
      action: "candidate-printing.unignore",
      entityType: "candidate-printing",
      entityId: `${provider}:${externalId}`,
      oldValues: { provider, externalId, finish },
    });
  }),

  deletePrintingLink: os.deletePrintingLink.handler(async ({ input, context }): Promise<void> => {
    const { provider, externalId, finish } = input;
    await context.repos.candidateCards.deletePrintingLinkOverride({ provider, externalId, finish });

    await recordAdminEvent(context.repos, context.userId, {
      action: "candidate-printing.unpin",
      entityType: "candidate-printing",
      entityId: `${provider}:${externalId}:${finish}`,
      oldValues: { provider, externalId, finish },
    });
  }),
};
