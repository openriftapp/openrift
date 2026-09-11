import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { implement } from "@orpc/server";

import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { acceptFavoritePrintingsForCard } from "../../candidates/services/accept-favorite-printings.js";
import {
  assertCandidatePrintingsInScope,
  assertSomeProviderInScope,
  reviewableProviderScope,
} from "../../candidates/services/card-review-scope.js";
import { relinkCandidatePrintings } from "../../candidates/services/relink-candidates.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { acceptPrinting, deletePrinting } from "../services/printing-admin.js";
import {
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
    const { printingId, field, value, source } = input;

    const printingBefore = await mut.getFullPrintingById(printingId);
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

    const normalizedValue = await normalizePrintingFieldValue(context.repos, {
      printingId,
      field,
      value,
      source,
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
    });

    await auditEvent(auditValue);
  }),

  acceptPrinting: os.acceptPrinting.handler(async ({ input, context }) => {
    const { catalogMutations, printingImages, markers, distributionChannels, printingEvents } =
      context.repos;
    const { cardId, printingFields, candidatePrintingIds } = input;

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

    // Without requireNew an identity collision updates the matching printing and
    // links the candidate to it, instead of failing.
    const printingId = await acceptPrinting(
      context.transact,
      { catalogMutations, printingImages, markers, distributionChannels, printingEvents },
      cardId,
      printingFields,
      candidatePrintingIds,
      context.io,
      { requireNew: true },
    );

    const card = await catalogMutations.getCardById(cardId);
    await recordAdminEvent(context.repos, context.userId, {
      action: "printing.accept",
      entityType: "printing",
      entityId: printingId,
      entityLabel: printingFields.shortCode,
      cardSlug: card?.slug ?? null,
      newValues: { printingFields, candidatePrintingIds },
    });

    // A brand-new printing has no rank row yet, and may complete an existing
    // one's foil-twin pair — both need the full refresh, not just the rank one.
    await context.repos.catalog.refreshCatalogViews();

    // Other providers' candidates for this printing were uploaded before it
    // existed, so their ingest-time key resolution missed it. Re-resolve now so
    // they leave the "new printing" list on the very next refetch.
    await relinkCandidatePrintings(context.repos);

    return { printingId };
  }),

  acceptFavoritePrintings: os.acceptFavoritePrintings.handler(async ({ input, context }) => {
    const {
      candidateCards,
      catalogMutations,
      printingImages,
      markers,
      distributionChannels,
      providerSettings,
      printingEvents,
    } = context.repos;
    const favoriteProviders = await providerSettings.favoriteProviders();

    const result = await acceptFavoritePrintingsForCard(
      context.transact,
      context.io,
      {
        candidateCards,
        catalogMutations,
        printingImages,
        markers,
        distributionChannels,
        printingEvents,
      },
      input.cardSlug,
      favoriteProviders,
    );

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

    if (result.printingsCreated > 0) {
      // Same reason as the single acceptPrinting handler: candidates from other
      // providers were keyed before these printings existed.
      await relinkCandidatePrintings(context.repos);
    }

    return { printingsCreated: result.printingsCreated, skipped: result.skipped };
  }),

  createPrinting: os.createPrinting.handler(async ({ input, context }) => {
    const { catalogMutations, printingImages, markers, distributionChannels, printingEvents } =
      context.repos;
    const { cardId, ...printingFields } = input;

    // An identity collision here is rejected; the shared upsert never overwrites it.
    const printingId = await acceptPrinting(
      context.transact,
      { catalogMutations, printingImages, markers, distributionChannels, printingEvents },
      cardId,
      printingFields,
      [],
      context.io,
      { requireNew: true },
    );

    const card = await catalogMutations.getCardById(cardId);
    await recordAdminEvent(context.repos, context.userId, {
      action: "printing.create",
      entityType: "printing",
      entityId: printingId,
      entityLabel: printingFields.shortCode,
      cardSlug: card?.slug ?? null,
      newValues: printingFields,
    });

    // A brand-new printing has no rank row yet, and may complete an existing
    // one's foil-twin pair — both need the full refresh, not just the rank one.
    await context.repos.catalog.refreshCatalogViews();

    return { printingId };
  }),
};
