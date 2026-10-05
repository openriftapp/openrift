import { WellKnown } from "@openrift/shared/well-known";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { imageId, joinFrontImage } from "../../../repositories/query-helpers.js";

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
    async upsert(cardId: string, data: CardErrataWrite): Promise<void> {
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
        .values({ cardId, ...values })
        .onConflict((oc) => oc.column("cardId").doUpdateSet(values))
        .execute();
    },

    async deleteByCardId(cardId: string): Promise<void> {
      await db.deleteFrom("cardErrata").where("cardId", "=", cardId).execute();
    },

    async getByCardId(cardId: string) {
      return (
        (await db
          .selectFrom("cardErrata")
          .select(ERRATA_COLUMNS)
          .where("cardId", "=", cardId)
          .executeTakeFirst()) ?? null
      );
    },

    getByCardIds(cardIds: string[]) {
      if (cardIds.length === 0) {
        return Promise.resolve([]);
      }
      return db
        .selectFrom("cardErrata")
        .select(["cardId", ...ERRATA_COLUMNS])
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

    /** Prefers an English printing whose text still differs from the corrected text. */
    listEntries() {
      return db
        .selectFrom("cardErrata")
        .innerJoin("cards", "cards.id", "cardErrata.cardId")
        .innerJoin("mvCardAggregates as mca", "mca.cardId", "cards.id")
        .leftJoinLateral(
          (eb) =>
            joinFrontImage(
              eb.selectFrom("printingsOrdered as po").innerJoin("sets", "sets.id", "po.setId"),
              "po",
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
              .where("po.language", "=", WellKnown.language.EN)
              .orderBy(PRINTED_MATCHES_CORRECTED)
              .orderBy("po.canonicalRank")
              .orderBy("po.shortCode")
              .orderBy("po.id")
              .limit(1)
              .as("p"),
          (join) => join.onTrue(),
        )
        .select([
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
        .execute();
    },
  };
}
