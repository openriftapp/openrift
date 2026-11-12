import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { liveCardForNorm } from "../../../repositories/candidate-card-sql.js";
import { pairedCardNameSql } from "../../../repositories/query-helpers.js";

async function deletePins(
  db: Kysely<Database>,
  rows: readonly { externalId: string; finish: string | null; provider: string }[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  await db
    .deleteFrom("printingLinkOverrides")
    .where((eb) =>
      eb.or(
        rows.map((row) =>
          eb.and([
            eb("externalId", "=", row.externalId),
            eb("finish", "=", row.finish ?? ""),
            eb("provider", "=", row.provider),
          ]),
        ),
      ),
    )
    .execute();
}

export function candidatePrintingLinksRepo(db: Kysely<Database>) {
  return {
    async linkCandidatePrintings(
      candidatePrintingIds: string[],
      printingUuid: string | null,
    ): Promise<void> {
      await db
        .updateTable("candidatePrintings")
        .set({ printingId: printingUuid })
        .where("id", "in", candidatePrintingIds)
        .execute();
    },

    async linkAndCheckCandidatePrintings(
      candidatePrintingIds: string[],
      printingUuid: string,
    ): Promise<void> {
      await db
        .updateTable("candidatePrintings")
        .set({ printingId: printingUuid, checkedAt: new Date() })
        .where("id", "in", candidatePrintingIds)
        .execute();
    },

    async linkIdentitiesForCandidatePrintings(ids: readonly string[]): Promise<
      {
        id: string;
        shortCode: string;
        finish: string | null;
        rarity: string | null;
        markerSlugs: string[];
        language: string | null;
        size: string | null;
        liveCardId: string | null;
      }[]
    > {
      if (ids.length === 0) {
        return [];
      }
      const rows = await sql<{
        id: string;
        shortCode: string;
        finish: string | null;
        rarity: string | null;
        markerSlugs: string[];
        language: string | null;
        size: string | null;
        liveCardId: string | null;
      }>`
        select
          cp.id,
          cp.short_code as "shortCode",
          cp.finish,
          cp.rarity,
          cp.marker_slugs as "markerSlugs",
          cp.language,
          cp.size,
          (select live_card.id from (${liveCardForNorm(sql.ref("cc.norm_name"))}) live_card) as "liveCardId"
        from candidate_printings cp
        join candidate_cards cc on cc.id = cp.candidate_card_id
        where cp.id in (${sql.join([...ids])})
      `.execute(db);
      return rows.rows;
    },

    async unlinkCandidatePrintingsByPrintingId(printingId: string): Promise<void> {
      await db
        .updateTable("candidatePrintings")
        .set({ printingId: null })
        .where("printingId", "=", printingId)
        .execute();
    },

    async upsertPrintingLinkOverrides(
      candidatePrintingIds: string[],
      printingId: string,
    ): Promise<void> {
      const rows = await db
        .selectFrom("candidatePrintings as cp")
        .innerJoin("candidateCards as cc", "cc.id", "cp.candidateCardId")
        .select(["cp.externalId", "cp.finish", "cc.provider"])
        .where("cp.id", "in", candidatePrintingIds)
        .execute();
      // Dedupe on the conflict key: two candidate printings sharing one
      // (external id, finish, provider) would make the single INSERT hit the
      // same row twice, which ON CONFLICT DO UPDATE refuses.
      const byKey = new Map(
        rows.map((row) => [
          `${row.provider}:${row.externalId}:${row.finish ?? ""}`,
          {
            externalId: row.externalId,
            finish: row.finish ?? "",
            provider: row.provider,
            printingId,
          },
        ]),
      );
      if (byKey.size === 0) {
        return;
      }
      await db
        .insertInto("printingLinkOverrides")
        .values([...byKey.values()])
        .onConflict((oc) =>
          oc.columns(["externalId", "finish", "provider"]).doUpdateSet({ printingId }),
        )
        .execute();
    },

    async removePrintingLinkOverrides(candidatePrintingIds: string[]): Promise<void> {
      const rows = await db
        .selectFrom("candidatePrintings as cp")
        .innerJoin("candidateCards as cc", "cc.id", "cp.candidateCardId")
        .select(["cp.externalId", "cp.finish", "cc.provider"])
        .where("cp.id", "in", candidatePrintingIds)
        .execute();
      await deletePins(db, rows);
    },

    async removePrintingLinkOverridesForCandidateCard(candidateCardId: string): Promise<void> {
      const rows = await db
        .selectFrom("candidatePrintings as cp")
        .innerJoin("candidateCards as cc", "cc.id", "cp.candidateCardId")
        .select(["cp.externalId", "cp.finish", "cc.provider"])
        .where("cp.candidateCardId", "=", candidateCardId)
        .execute();
      await deletePins(db, rows);
    },

    listPrintingLinkOverrides(): Promise<
      {
        provider: string;
        externalId: string;
        finish: string;
        printingId: string;
        shortCode: string;
        cardSlug: string;
        cardName: string;
        createdAt: Date;
      }[]
    > {
      return db
        .selectFrom("printingLinkOverrides as plo")
        .innerJoin("printings as pr", "pr.id", "plo.printingId")
        .innerJoin("faces as p", "p.id", "pr.face1Id")
        .innerJoin("cards as c", "c.id", "p.cardId")
        .select([
          "plo.provider",
          "plo.externalId",
          "plo.finish",
          "plo.printingId",
          "p.shortCode",
          "c.slug as cardSlug",
          pairedCardNameSql("c.name", "pr").as("cardName"),
          "plo.createdAt",
        ])
        .orderBy("plo.createdAt", "desc")
        .execute();
    },

    async deletePrintingLinkOverride(key: {
      provider: string;
      externalId: string;
      finish: string;
    }): Promise<void> {
      await db
        .deleteFrom("printingLinkOverrides")
        .where("provider", "=", key.provider)
        .where("externalId", "=", key.externalId)
        .where("finish", "=", key.finish)
        .execute();
    },

    async deletePrintingLinkOverridesById(printingId: string): Promise<void> {
      await db.deleteFrom("printingLinkOverrides").where("printingId", "=", printingId).execute();
    },
  };
}
