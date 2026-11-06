import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import { extractKeywords } from "@openrift/shared/keywords";
import { WellKnown } from "@openrift/shared/well-known";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { importErrata } from "../../candidates/services/import-errata.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";

const os = implement(adminCardMutationsContract).$context<ApiContext>().use(requireAuthedUser);

function keywordsOf(
  errata: { correctedRulesText: string | null; correctedEffectText: string | null } | null,
  printings: { printedRulesText: string | null; printedEffectText: string | null }[],
): string[] {
  return [
    errata?.correctedRulesText,
    errata?.correctedEffectText,
    ...printings.flatMap((printing) => [printing.printedRulesText, printing.printedEffectText]),
  ]
    .flatMap((text) => extractKeywords(text ?? ""))
    .filter((keyword, index, all) => all.indexOf(keyword) === index);
}

export const adminCardMutationsErrataRouter = {
  upsertErrata: os.upsertErrata.handler(async ({ input, context }): Promise<void> => {
    const { catalogMutations: mut, cardErrata } = context.repos;
    const { cardId, language, ...values } = input;

    const errataBefore = await cardErrata.get(cardId, language);
    const card = await mut.getCardById(cardId);

    await cardErrata.upsert(cardId, language, values);

    const printingTexts = await mut.getPrintingTextsForCardId(cardId);
    const englishErrata =
      language === WellKnown.language.EN
        ? values
        : await cardErrata.get(cardId, WellKnown.language.EN);
    await mut.updateCardById(cardId, {
      keywords: keywordsOf(englishErrata, printingTexts),
    });

    // Errata text can add or remove a token reference just like printing text.
    await context.repos.cardTokens.recomputeForCard(cardId);
    await context.repos.catalog.refreshCardAggregates();

    await recordAdminEvent(context.repos, context.userId, {
      action: "errata.upsert",
      entityType: "errata",
      entityId: cardId,
      entityLabel: card?.name ?? null,
      cardSlug: card?.slug ?? null,
      oldValues: errataBefore ? { language, ...errataBefore } : null,
      newValues: { language, ...values },
    });
  }),

  deleteErrata: os.deleteErrata.handler(async ({ input, context }): Promise<void> => {
    const { catalogMutations: mut, cardErrata } = context.repos;
    const { cardId, language } = input;

    const errataBefore = await cardErrata.get(cardId, language);
    const card = await mut.getCardById(cardId);

    await cardErrata.delete(cardId, language);

    const printingTexts = await mut.getPrintingTextsForCardId(cardId);
    const englishErrata = await cardErrata.get(cardId, WellKnown.language.EN);
    await mut.updateCardById(cardId, {
      keywords: keywordsOf(englishErrata, printingTexts),
    });

    // Dropping errata can drop the only text that referenced a token.
    await context.repos.cardTokens.recomputeForCard(cardId);
    await context.repos.catalog.refreshCardAggregates();

    await recordAdminEvent(context.repos, context.userId, {
      action: "errata.delete",
      entityType: "errata",
      entityId: cardId,
      entityLabel: card?.name ?? null,
      cardSlug: card?.slug ?? null,
      oldValues: errataBefore ? { language, ...errataBefore } : null,
    });
  }),

  uploadErrata: os.uploadErrata.handler(async ({ input, context }) => {
    const result = await importErrata(context.transact, {
      entries: input.entries,
      dryRun: input.dryRun,
    });

    if (!input.dryRun) {
      await recordAdminEvent(context.repos, context.userId, {
        action: "errata.upload",
        entityType: "upload",
        newValues: {
          newCount: result.newCount,
          updatedCount: result.updatedCount,
          unchangedCount: result.unchangedCount,
          errors: result.errors.length,
        },
      });
    }

    return result;
  }),
};
