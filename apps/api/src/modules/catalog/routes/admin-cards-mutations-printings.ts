import type { AcceptPrintingGroup } from "@openrift/shared/contracts/admin/card-mutations";
import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import { implement } from "@orpc/server";

import { forbidden } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import {
  assertCandidatePrintingsInScope,
  assertSomeProviderInScope,
  reviewableProviderScope,
} from "../../candidates/lib/card-review-scope.js";
import { finishPrintingAccepts } from "../../candidates/services/accept-candidate-printings.js";
import { acceptFavoritePrintingsForCard } from "../../candidates/services/accept-favorite-printings.js";
import { recordCandidateChecks } from "../../candidates/services/check-card-candidates.js";
import { recordAdminEvent, recordAdminEvents } from "../../system/services/record-admin-event.js";
import type { NewPrinting } from "../services/printing-admin.js";
import {
  createNewPrinting,
  createNewPrintings,
  deletePrinting,
} from "../services/printing-admin.js";
import {
  acceptPrintingFieldValue,
  changesCatalogViews,
} from "../services/printing-field-writes.js";

const os = implement(adminCardMutationsContract).$context<ApiContext>().use(requireAuthedUser);

async function acceptPrintingGroups(
  context: ApiContext & { userId: string },
  cardId: string,
  groups: readonly AcceptPrintingGroup[],
): Promise<string[]> {
  const scope = await reviewableProviderScope(context.adminAccess, context.repos.providerSettings);
  if (scope !== null) {
    // Without candidate ids this is de-facto manual printing creation
    // (createPrinting), which the card-review section excludes.
    if (groups.some((group) => group.candidatePrintingIds.length === 0)) {
      throw forbidden("Forbidden");
    }
    await assertCandidatePrintingsInScope(
      context.repos.candidateCards,
      [...new Set(groups.flatMap((group) => group.candidatePrintingIds))],
      scope,
    );
  }

  const created = await createNewPrintings(
    context.transact,
    cardId,
    groups.map((group) => ({
      printingFields: group.printingFields,
      candidatePrintingIds: group.candidatePrintingIds,
      secondFaceId: group.secondSideFaceId ?? null,
    })),
  );

  await recordAdminEvents(context.repos, context.userId, async () => {
    const card = await context.repos.catalogMutations.getCardById(cardId);
    return created.map(({ printingId }, index) => {
      const group = groups[index];
      return {
        action: "printing.accept" as const,
        entityType: "printing" as const,
        entityId: printingId,
        entityLabel: group?.printingFields.shortCode ?? null,
        cardSlug: card?.slug ?? null,
        newValues: {
          printingFields: group?.printingFields,
          candidatePrintingIds: group?.candidatePrintingIds,
          secondSideFaceId: group?.secondSideFaceId,
        },
      };
    });
  });

  await finishPrintingAccepts(context.repos, context.io, created);
  return created.map(({ printingId }) => printingId);
}

export const adminCardMutationsPrintingsRouter = {
  deletePrinting: os.deletePrinting.handler(async ({ input, context }): Promise<void> => {
    const { catalogMutations, catalogDeleteGuards } = context.repos;
    const before = await catalogMutations.getFullPrintingById(input.printingId);
    await deletePrinting(
      context.transact,
      context.io,
      { catalogMutations, catalogDeleteGuards },
      input.printingId,
    );

    await recordAdminEvent(context.repos, context.userId, {
      action: "printing.delete",
      entityType: "printing",
      entityId: input.printingId,
      entityLabel: before?.shortCode ?? null,
      oldValues: before
        ? {
            cardId: before.cardId,
            shortCode: before.shortCode,
            finish: before.finish,
            publicCode: before.publicCode,
            language: before.language,
          }
        : null,
    });
  }),

  acceptPrintingField: os.acceptPrintingField.handler(async ({ input, context, errors }) => {
    const { catalogMutations: mut } = context.repos;
    const { printingId, field, value, source, faceId, expected } = input;
    const side = faceId === undefined ? input.side : await mut.sideOfFace(printingId, faceId);
    assertFound(side, "That face is not on the printing");

    const printingBefore = await mut.getFullPrintingById(printingId, side);
    assertFound(printingBefore, "Printing not found");

    const scope = await reviewableProviderScope(
      context.adminAccess,
      context.repos.providerSettings,
    );
    if (scope !== null) {
      assertSomeProviderInScope(
        await context.repos.candidateCards.candidateProvidersForCard(printingBefore.cardId),
        scope,
      );
    }

    const faceCard = await mut.getCardById(printingBefore.cardId);

    const args = { printingId, field, value, source, side, expected };
    const outcome =
      expected === undefined
        ? await acceptPrintingFieldValue(context.transact, context.repos, args, printingBefore)
        : await context.transact(async (trx) => {
            await trx.catalogMutations.lockPrintingSide(printingId, side);
            return acceptPrintingFieldValue((run) => run(trx), trx, args);
          });
    if (outcome.status === "changed") {
      throw errors.FIELD_CHANGED();
    }
    if (outcome.status === "unchanged") {
      return { written: false };
    }
    if (changesCatalogViews(field)) {
      await context.repos.catalog.refreshCatalogViews();
    }

    // distributionChannelSlugs lives only in a junction table, so its old value is null.
    await recordAdminEvent(context.repos, context.userId, {
      action: "printing.accept-field",
      entityType: "printing",
      entityId: printingId,
      entityLabel: outcome.printingBefore.shortCode,
      cardSlug: faceCard?.slug ?? null,
      oldValues:
        field === "distributionChannelSlugs"
          ? null
          : { [field]: (outcome.printingBefore as Record<string, unknown>)[field] },
      newValues: { [field]: outcome.auditValue },
    });
    return { written: true };
  }),

  acceptPrinting: os.acceptPrinting.handler(async ({ input, context }) => {
    const { cardId, ...group } = input;
    const [printingId] = await acceptPrintingGroups(context, cardId, [group]);
    assertFound(printingId, "Printing not found");
    return { printingId };
  }),

  acceptPrintings: os.acceptPrintings.handler(async ({ input, context }) => ({
    printingIds: await acceptPrintingGroups(context, input.cardId, input.groups),
  })),

  acceptFavoritePrintings: os.acceptFavoritePrintings.handler(async ({ input, context }) => {
    const favoriteProviders = await context.repos.providerSettings.favoriteProviders();

    const created: NewPrinting[] = [];
    let result: Awaited<ReturnType<typeof acceptFavoritePrintingsForCard>>;
    try {
      result = await acceptFavoritePrintingsForCard(
        context.transact,
        context.repos,
        input.cardSlug,
        favoriteProviders,
        created,
      );
    } finally {
      await finishPrintingAccepts(context.repos, context.io, created);
    }

    await recordAdminEvent(context.repos, context.userId, {
      action: "printing.accept-favorites",
      entityType: "printing",
      entityLabel: input.cardSlug,
      cardSlug: input.cardSlug,
      newValues: {
        printingsCreated: result.printingsCreated,
        skipped: result.skipped.length,
        createdPrintingIds: result.createdPrintingIds,
      },
    });
    await recordCandidateChecks(context.repos, context.userId, "candidate-card.check", {
      ids: result.checkedCandidateCardIds,
      cardSlug: input.cardSlug,
    });

    return { printingsCreated: result.printingsCreated, skipped: result.skipped };
  }),

  createPrinting: os.createPrinting.handler(async ({ input, context }) => {
    const { cardId, ...printingFields } = input;

    const created = await createNewPrinting(context.transact, cardId, printingFields, []);
    const { printingId } = created;

    const card = await context.repos.catalogMutations.getCardById(cardId);
    await recordAdminEvent(context.repos, context.userId, {
      action: "printing.create",
      entityType: "printing",
      entityId: printingId,
      entityLabel: printingFields.shortCode,
      cardSlug: card?.slug ?? null,
      newValues: printingFields,
    });

    await finishPrintingAccepts(context.repos, context.io, [created]);

    return { printingId };
  }),
};
