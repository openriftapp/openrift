import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import type { CardType, Domain, SuperType } from "@openrift/shared/types/enums";
import { normalizeNameForIdentity } from "@openrift/shared/utils";
import { implement } from "@orpc/server";

import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { acceptFavoriteNewCard } from "../../candidates/services/accept-gallery.js";
import {
  assertSomeProviderInScope,
  reviewableProviderScope,
} from "../../candidates/services/card-review-scope.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { deleteCard } from "../services/card-admin.js";
import { normalizeCardFieldValue, writeCardField } from "../services/card-field-writes.js";

const os = implement(adminCardMutationsContract).$context<ApiContext>().use(requireAuthedUser);

export const adminCardMutationsCardsRouter = {
  renameCard: os.renameCard.handler(async ({ input, context }): Promise<void> => {
    const { catalogMutations: mut } = context.repos;
    const { cardId, newId } = input;

    if (!newId?.trim()) {
      throw new AppError(400, ERROR_CODES.BAD_REQUEST, "newId is required");
    }

    const card = await mut.getCardById(cardId);
    assertFound(card, "Card not found");

    if (newId === card.slug) {
      return;
    }

    // UUID PK is immutable -- only the slug changes
    await mut.renameCardSlugById(card.id, newId.trim());

    await recordAdminEvent(context.repos, context.userId, {
      action: "card.rename",
      entityType: "card",
      entityId: card.id,
      entityLabel: card.name,
      cardSlug: newId.trim(),
      oldValues: { slug: card.slug },
      newValues: { slug: newId.trim() },
    });
  }),

  deleteCard: os.deleteCard.handler(async ({ input, context }): Promise<void> => {
    const { catalogMutations, catalogDeleteGuards } = context.repos;
    const before = await catalogMutations.getCardById(input.cardId);
    await deleteCard(
      context.transact,
      context.io,
      { catalogMutations, catalogDeleteGuards },
      input.cardId,
    );
    await context.repos.catalog.refreshCatalogViews();

    await recordAdminEvent(context.repos, context.userId, {
      action: "card.delete",
      entityType: "card",
      entityId: input.cardId,
      entityLabel: before?.name ?? null,
      oldValues: before ? { id: before.id, name: before.name, slug: before.slug } : null,
    });
  }),

  acceptField: os.acceptField.handler(async ({ input, context }): Promise<void> => {
    const { catalogMutations: mut, candidateCards, providerSettings } = context.repos;
    const { cardId, field, value } = input;

    // Grant holders may only edit cards that still have candidate data from
    // an allowed provider — without this, accept-field would be unscoped
    // card editing by id.
    const scope = await reviewableProviderScope(context.adminAccess, providerSettings);
    if (scope !== null) {
      assertSomeProviderInScope(await candidateCards.candidateProvidersForCard(cardId), scope);
    }

    const finalValue = normalizeCardFieldValue(field, value);

    // Snapshot before the write for the audit event. domains/superTypes live
    // only in junction tables — no cheap before-read, so their old is null;
    // types uses the denormalized cards.type scalar.
    const cardBefore = await mut.getFullCardById(cardId);
    const auditEvent = () =>
      recordAdminEvent(context.repos, context.userId, {
        action: "card.accept-field",
        entityType: "card",
        entityId: cardId,
        entityLabel: cardBefore?.name ?? null,
        cardSlug: cardBefore?.slug ?? null,
        oldValues:
          field === "domains" || field === "superTypes"
            ? null
            : {
                [field]:
                  field === "types"
                    ? cardBefore?.type
                    : (cardBefore as Record<string, unknown> | undefined)?.[field],
              },
        newValues: { [field]: finalValue },
      });

    const { refreshViews } = await writeCardField(mut, {
      cardId,
      field,
      value: finalValue,
      previousName: cardBefore?.name ?? null,
    });
    if (refreshViews) {
      await context.repos.catalog.refreshCatalogViews();
    }

    await auditEvent();
  }),

  acceptNewCard: os.acceptNewCard.handler(async ({ input, context }): Promise<void> => {
    const { name, cardFields } = input;

    // Grant holders may only accept names that have candidate data from an
    // allowed provider — otherwise this endpoint is arbitrary card creation
    // (the manual createCard is excluded from the card-review section).
    const scope = await reviewableProviderScope(
      context.adminAccess,
      context.repos.providerSettings,
    );
    if (scope !== null) {
      assertSomeProviderInScope(
        await context.repos.candidateCards.candidateProvidersForNormName(name),
        scope,
      );
    }

    await context.transact(async (trxRepos) => {
      // FK constraints validate values at DB level — safe to cast from z.string()
      await trxRepos.catalogMutations.acceptNewCardFromSources(
        cardFields as typeof cardFields & {
          types: CardType[];
          domains: Domain[];
          superTypes?: SuperType[];
        },
        name,
      );
    });

    await context.repos.catalog.refreshCatalogViews();

    await recordAdminEvent(context.repos, context.userId, {
      action: "card.accept-new",
      entityType: "card",
      entityId: cardFields.id,
      entityLabel: cardFields.name,
      cardSlug: cardFields.id,
      newValues: cardFields,
    });
  }),

  acceptFavoriteNewCard: os.acceptFavoriteNewCard.handler(async ({ input, context }) => {
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

    const result = await acceptFavoriteNewCard(
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
      input.name,
      favoriteProviders,
    );

    await context.repos.catalog.refreshCatalogViews();

    await recordAdminEvent(context.repos, context.userId, {
      action: "card.accept-favorites",
      entityType: "card",
      entityId: result.cardSlug,
      entityLabel: input.name,
      cardSlug: result.cardSlug,
      newValues: {
        cardSlug: result.cardSlug,
        printingsCreated: result.printingsCreated,
        skipped: result.skipped,
      },
    });

    return result;
  }),

  linkUnmatched: os.linkUnmatched.handler(async ({ input, context }): Promise<void> => {
    const { catalogMutations: mut } = context.repos;
    const { name, cardId } = input;

    if (!cardId) {
      throw new AppError(400, ERROR_CODES.BAD_REQUEST, "cardId required");
    }

    const card = await mut.getCardById(cardId);
    assertFound(card, "Target card not found");

    await context.transact(async (trxRepos) => {
      await trxRepos.catalogMutations.createNameAliases(name, card.id);
    });

    await recordAdminEvent(context.repos, context.userId, {
      action: "card.link-unmatched",
      entityType: "card",
      entityId: card.id,
      entityLabel: card.name,
      cardSlug: card.slug,
      newValues: { name, cardId },
    });
  }),

  createCard: os.createCard.handler(async ({ input, context }) => {
    const cardFields = input;

    await context.transact(async (trxRepos) => {
      await trxRepos.catalogMutations.acceptNewCardFromSources(
        cardFields as typeof cardFields & {
          types: CardType[];
          domains: Domain[];
          superTypes?: SuperType[];
        },
        normalizeNameForIdentity(cardFields.name),
      );
    });

    await context.repos.catalog.refreshCatalogViews();

    await recordAdminEvent(context.repos, context.userId, {
      action: "card.create",
      entityType: "card",
      entityId: cardFields.id,
      entityLabel: cardFields.name,
      cardSlug: cardFields.id,
      newValues: cardFields,
    });

    return { cardSlug: cardFields.id };
  }),
};
