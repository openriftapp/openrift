import { WellKnown } from "@openrift/shared/well-known";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { imageId, joinFaceImage } from "../../../repositories/query-helpers.js";

const ERRATA_COLUMNS = [
  "announcementId",
  "correctedRulesText",
  "correctedEffectText",
  "source",
  "sourceUrl",
  "effectiveDate",
] as const;

const PRINTED_MATCHES_CORRECTED = sql<boolean>`(
  (card_errata.corrected_rules_text IS NULL
    OR po.printed_rules_text IS NOT DISTINCT FROM card_errata.corrected_rules_text)
  AND (card_errata.corrected_effect_text IS NULL
    OR po.printed_effect_text IS NOT DISTINCT FROM card_errata.corrected_effect_text)
)`;

export interface CardErrataWrite {
  announcementId: string | null;
  correctedRulesText: string | null;
  correctedEffectText: string | null;
  source: string | null;
  sourceUrl: string | null;
  effectiveDate: string | null;
}

export interface ErrataAnnouncementWrite {
  name: string;
  publishedOn: string;
  url: string;
}

/**
 * Catalog assembly and candidate review read errata through `catalogRepo` /
 * `candidateCardsRepo`; this repo owns writes, announcements and the errata list page.
 */
export function cardErrataRepo(db: Kysely<Database>) {
  return {
    async upsert(cardId: string, language: string, data: CardErrataWrite): Promise<void> {
      const values = {
        announcementId: data.announcementId,
        correctedRulesText: data.correctedRulesText,
        correctedEffectText: data.correctedEffectText,
        source: data.source,
        sourceUrl: data.sourceUrl,
        effectiveDate: data.effectiveDate,
      };
      await db
        .insertInto("cardErrata")
        .values({ cardId, language, ...values })
        .onConflict((oc) => oc.columns(["cardId", "language"]).doUpdateSet(values))
        .execute();
    },

    async delete(cardId: string, language: string): Promise<void> {
      await db
        .deleteFrom("cardErrata")
        .where("cardId", "=", cardId)
        .where("language", "=", language)
        .execute();
    },

    async get(cardId: string, language: string) {
      return (
        (await db
          .selectFrom("cardErrata")
          .select(ERRATA_COLUMNS)
          .where("cardId", "=", cardId)
          .where("language", "=", language)
          .executeTakeFirst()) ?? null
      );
    },

    getByCardIds(cardIds: string[]) {
      if (cardIds.length === 0) {
        return Promise.resolve([]);
      }
      return db
        .selectFrom("cardErrata")
        .select(["cardId", "language", ...ERRATA_COLUMNS])
        .where("cardId", "in", cardIds)
        .execute();
    },

    announcements() {
      return db
        .selectFrom("errataAnnouncements")
        .select(["id", "name", "publishedOn", "url"])
        .orderBy("publishedOn", "desc")
        .orderBy("name")
        .execute();
    },

    async upsertAnnouncement(data: ErrataAnnouncementWrite): Promise<string> {
      const row = await db
        .insertInto("errataAnnouncements")
        .values(data)
        .onConflict((oc) =>
          oc.column("name").doUpdateSet({ publishedOn: data.publishedOn, url: data.url }),
        )
        .returning("id")
        .executeTakeFirstOrThrow();
      return row.id;
    },

    /** Prefers a printing in the errata's language whose text still differs from the corrected text. */
    listEntries() {
      return db
        .selectFrom("cardErrata")
        .innerJoin("cards", "cards.id", "cardErrata.cardId")
        .innerJoin("mvCardAggregates as mca", "mca.cardId", "cards.id")
        .leftJoinLateral(
          (eb) =>
            joinFaceImage(
              eb.selectFrom("printingSidesOrdered as po").innerJoin("sets", "sets.id", "po.setId"),
              "po.faceId",
            )
              .select([
                "po.shortCode",
                "po.printedRulesText",
                "po.printedEffectText",
                "sets.slug as setSlug",
                "sets.name as setName",
                "sets.sortOrder as setSortOrder",
                imageId("imgf").as("imageId"),
              ])
              .whereRef("po.cardId", "=", "cards.id")
              .whereRef("po.language", "=", "cardErrata.language")
              .orderBy(PRINTED_MATCHES_CORRECTED)
              .orderBy("po.canonicalRank")
              .orderBy("po.shortCode")
              .orderBy("po.printingId")
              .limit(1)
              .as("p"),
          (join) => join.onTrue(),
        )
        .select([
          "cardErrata.language",
          "cardErrata.announcementId",
          "cardErrata.correctedRulesText",
          "cardErrata.correctedEffectText",
          "cardErrata.source",
          "cardErrata.sourceUrl",
          "cardErrata.effectiveDate",
          "cards.slug",
          "cards.name",
          "cards.tags",
          "mca.types",
          "mca.domains",
          "p.shortCode",
          "p.printedRulesText",
          "p.printedEffectText",
          "p.setSlug",
          "p.setName",
          "p.setSortOrder",
          "p.imageId",
        ])
        .orderBy("cards.name")
        .orderBy(sql`card_errata.language <> ${WellKnown.language.EN}`)
        .orderBy("cardErrata.language")
        .execute();
    },
  };
}
