import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { liveCardForNorm } from "../../../repositories/candidate-card-sql.js";
import type {
  CandidatePrintingComparison,
  ComparableCardValues,
  LivePrintingComparison,
} from "./candidate-comparison-sql.js";
import {
  candidateCardValues,
  candidatePrintingValues,
  candidateSideOfPrinting,
  liveCardValues,
  livePrintingValues,
} from "./candidate-comparison-sql.js";

export interface UncheckedCandidateCardWithLive {
  id: string;
  candidate: ComparableCardValues;
  live: ComparableCardValues | null;
}

export interface UncheckedCandidatePrintingWithLive {
  id: string;
  printedTotal: number | null;
  candidate: CandidatePrintingComparison;
  live: LivePrintingComparison;
}

export function candidateMatchingRepo(db: Kysely<Database>) {
  return {
    async listUncheckedCandidateCardsWithLive(
      excludeProvider: string,
      afterId: string | null,
      limit: number,
    ): Promise<UncheckedCandidateCardWithLive[]> {
      const rows = await sql<UncheckedCandidateCardWithLive>`
        select
          cc.id,
          ${candidateCardValues} as candidate,
          (
            select ${liveCardValues}
            from (${liveCardForNorm(sql.ref("cc.norm_name"))}) live_card
            join cards c on c.id = live_card.id
            join mv_card_aggregates mca on mca.card_id = c.id
          ) as live
        from candidate_cards cc
        where cc.checked_at is null
          and cc.provider <> ${excludeProvider}
          ${afterId === null ? sql`` : sql`and cc.id > ${afterId}`}
        order by cc.id
        limit ${limit}
      `.execute(db);
      return rows.rows;
    },

    /** Only linked candidate printings compare; an unlinked one is a new printing. */
    async listUncheckedCandidatePrintingsWithLive(
      excludeProvider: string,
      afterId: string | null,
      limit: number,
    ): Promise<UncheckedCandidatePrintingWithLive[]> {
      const rows = await sql<UncheckedCandidatePrintingWithLive>`
        select
          cp.id,
          s.printed_total as "printedTotal",
          ${candidatePrintingValues} as candidate,
          ${livePrintingValues} as live
        from candidate_printings cp
        join candidate_cards cc on cc.id = cp.candidate_card_id
        join printings pr on pr.id = cp.printing_id
        ${candidateSideOfPrinting}
        join sets s on s.id = p.set_id
        where cp.checked_at is null
          and cc.provider <> ${excludeProvider}
          ${afterId === null ? sql`` : sql`and cp.id > ${afterId}`}
        order by cp.id
        limit ${limit}
      `.execute(db);
      return rows.rows;
    },

    async checkCandidateCardsByIds(ids: readonly string[], now: Date): Promise<number> {
      if (ids.length === 0) {
        return 0;
      }
      const result = await db
        .updateTable("candidateCards")
        .set({ checkedAt: now })
        .where("id", "in", [...ids])
        .where("checkedAt", "is", null)
        .executeTakeFirstOrThrow();
      return Number(result.numUpdatedRows);
    },

    async checkCandidatePrintingsByIds(ids: readonly string[], now: Date): Promise<number> {
      if (ids.length === 0) {
        return 0;
      }
      const result = await db
        .updateTable("candidatePrintings")
        .set({ checkedAt: now })
        .where("id", "in", [...ids])
        .where("checkedAt", "is", null)
        .executeTakeFirstOrThrow();
      return Number(result.numUpdatedRows);
    },
  };
}
