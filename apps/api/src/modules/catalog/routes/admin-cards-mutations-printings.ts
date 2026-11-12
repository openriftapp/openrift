import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { implement } from "@orpc/server";

import { AppError } from "../../../errors.js";
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
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import type { NewPrinting } from "../services/printing-admin.js";
import { createNewPrinting, deletePrinting } from "../services/printing-admin.js";
import {
  changesCatalogViews,
  normalizePrintingFieldValue,
  writePrintingField,
} from "../services/printing-field-writes.js";

const os = implement(adminCardMutationsContract).$context<ApiContext>().use(requireAuthedUser);

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

  acceptPrintingField: os.acceptPrintingField.handler(async ({ input, context }): Promise<void> => {
    const { catalogMutations: mut } = context.repos;
    const { printingId, field, value, source, faceId } = input;
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

    const normalizedValue = await normalizePrintingFieldValue(context.repos, {
      printingId,
      field,
      value,
      source,
      side,
    });

    // Audit snapshot: distributionChannelSlugs lives only in a junction table
    // (no denormalized column), so its old is null; everything else — including
    // markerSlugs — is on the printings row already fetched above.
    const auditEvent = (written: unknown) =>
      recordAdminEvent(context.repos, context.userId, {
        action: "printing.accept-field",
        entityType: "printing",
        entityId: printingId,
        entityLabel: printingBefore.shortCode,
        cardSlug: faceCard?.slug ?? null,
        oldValues:
          field === "distributionChannelSlugs"
            ? null
            : { [field]: (printingBefore as Record<string, unknown>)[field] },
        newValues: { [field]: written },
      });

    const { auditValue } = await writePrintingField(context.transact, context.repos, {
      printingId,
      field,
      value: normalizedValue,
      side,
    });
    if (changesCatalogViews(field)) {
      await context.repos.catalog.refreshCatalogViews();
    }

    await auditEvent(auditValue);
  }),

  acceptPrinting: os.acceptPrinting.handler(async ({ input, context }) => {
    const { cardId, printingFields, candidatePrintingIds, secondSideFaceId } = input;

    const scope = await reviewableProviderScope(
      context.adminAccess,
      context.repos.providerSettings,
    );
    if (scope !== null) {
      // Without candidate ids this is de-facto manual printing creation
      // (createPrinting), which the card-review section excludes.
      if (candidatePrintingIds.length === 0) {
        throw new AppError(403, ERROR_CODES.FORBIDDEN, "Forbidden");
      }
      await assertCandidatePrintingsInScope(
        context.repos.candidateCards,
        candidatePrintingIds,
        scope,
      );
    }

    const created = await createNewPrinting(
      context.transact,
      cardId,
      printingFields,
      candidatePrintingIds,
      { secondFaceId: secondSideFaceId ?? null },
    );
    const { printingId } = created;

    const card = await context.repos.catalogMutations.getCardById(cardId);
    await recordAdminEvent(context.repos, context.userId, {
      action: "printing.accept",
      entityType: "printing",
      entityId: printingId,
      entityLabel: printingFields.shortCode,
      cardSlug: card?.slug ?? null,
      newValues: { printingFields, candidatePrintingIds, secondSideFaceId },
    });

    await finishPrintingAccepts(context.repos, context.io, [created]);

    return { printingId };
  }),

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
