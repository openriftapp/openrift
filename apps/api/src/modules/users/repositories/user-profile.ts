import { legendDisplayName } from "@openrift/shared/utils";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { cardTypesColumn, imageId, joinFrontImage } from "../../../repositories/query-helpers.js";
import type { Tournament } from "../../tournaments/repositories/tournaments-shared.js";

export interface CollectionSummary {
  copies: number;
  uniqueCards: number;
}

export interface AcceptedSubmissionCounts {
  corrections: number;
  newCards: number;
  images: number;
}

export interface DeckSummary {
  total: number;
  topLegend: { name: string; slug: string } | null;
}

export interface CompletedParticipation {
  tournament: Tournament;
  participantId: string;
}

/** Read-only facts about one user for their public profile page. */
export function userProfileRepo(db: Kysely<Database>) {
  return {
    async lastActiveAt(userId: string): Promise<Date | null> {
      const row = await db
        .selectFrom("sessions")
        .select((eb) => eb.fn.max("updatedAt").as("lastActiveAt"))
        .where("userId", "=", userId)
        .executeTakeFirst();
      return row?.lastActiveAt ?? null;
    },

    // Copies carry no owner; a user's cards are copies in their own
    // collections, not group-owned copies.
    async collectionSummary(userId: string): Promise<CollectionSummary> {
      const row = await db
        .selectFrom("copies as c")
        .innerJoin("collections as col", "col.id", "c.collectionId")
        .innerJoin("printings as p", "p.id", "c.printingId")
        .select((eb) => [
          eb.cast<number>(eb.fn.countAll(), "integer").as("copies"),
          sql<number>`count(distinct p.card_id)::int`.as("uniqueCards"),
        ])
        .where("col.userId", "=", userId)
        .executeTakeFirst();
      return { copies: row?.copies ?? 0, uniqueCards: row?.uniqueCards ?? 0 };
    },

    async acceptedSubmissionCounts(userId: string): Promise<AcceptedSubmissionCounts> {
      const rows = await db
        .selectFrom("cardSubmissions")
        .select((eb) => ["kind", eb.cast<number>(eb.fn.countAll(), "integer").as("count")])
        .where("userId", "=", userId)
        .where("status", "=", "accepted")
        .groupBy("kind")
        .execute();
      const counts: AcceptedSubmissionCounts = { corrections: 0, newCards: 0, images: 0 };
      for (const row of rows) {
        if (row.kind === "correction") {
          counts.corrections = row.count;
        } else if (row.kind === "new_card") {
          counts.newCards = row.count;
        } else if (row.kind === "image") {
          counts.images = row.count;
        }
      }
      return counts;
    },

    async metaEventCredits(userId: string): Promise<number> {
      const row = await db
        .selectFrom("metaCredits")
        .select(sql<number>`count(distinct meta_event_id)::int`.as("count"))
        .where("userId", "=", userId)
        .executeTakeFirst();
      return row?.count ?? 0;
    },

    async deckSummary(userId: string): Promise<DeckSummary> {
      const [total, legend] = await Promise.all([
        db
          .selectFrom("decks")
          .select((eb) => eb.cast<number>(eb.fn.countAll(), "integer").as("count"))
          .where("userId", "=", userId)
          .where("archivedAt", "is", null)
          .where("isDraft", "=", false)
          .executeTakeFirst(),
        db
          .selectFrom("deckCards as dc")
          .innerJoin("decks as d", "d.id", "dc.deckId")
          .innerJoin("cards as card", "card.id", "dc.cardId")
          .leftJoin("mvCardAggregates as mca", "mca.cardId", "card.id")
          .select((eb) => [
            "card.name",
            "card.slug",
            "card.tags",
            cardTypesColumn(),
            eb.cast<number>(eb.fn.countAll(), "integer").as("count"),
          ])
          .where("d.userId", "=", userId)
          .where("d.archivedAt", "is", null)
          .where("d.isDraft", "=", false)
          .where("dc.zone", "=", "legend")
          .groupBy(["card.id", "card.name", "card.slug", "card.tags", "mca.types"])
          .orderBy("count", "desc")
          .orderBy("card.name", "asc")
          .limit(1)
          .executeTakeFirst(),
      ]);
      return {
        total: total?.count ?? 0,
        topLegend: legend ? { name: legendDisplayName(legend), slug: legend.slug } : null,
      };
    },

    /** Dropped players still finished the tournament; requests and no-shows did not play. */
    async completedTournamentParticipations(userId: string): Promise<CompletedParticipation[]> {
      const rows = await db
        .selectFrom("tournamentParticipants as tp")
        .innerJoin("tournaments as t", "t.id", "tp.tournamentId")
        .selectAll("t")
        .select("tp.id as participantId")
        .where("tp.userId", "=", userId)
        .where("tp.status", "in", ["active", "dropped"])
        .where("t.status", "=", "completed")
        .orderBy("t.startsAt", "desc")
        .execute();
      return rows.map(({ participantId, ...tournament }) => ({ tournament, participantId }));
    },

    /** Newest copies first, so the row changes as the collection grows. */
    async collectionPreviewImageIds(
      collectionIds: readonly string[],
      limit: number,
    ): Promise<Map<string, string[]>> {
      const previews = await Promise.all(
        collectionIds.map(async (collectionId) => {
          const rows = await joinFrontImage(
            db.selectFrom("copies as c").innerJoin("printings as p", "p.id", "c.printingId"),
          )
            .select(imageId("imgf").as("imageId"))
            .where("c.collectionId", "=", collectionId)
            .where("imgf.rehostedUrl", "is not", null)
            .orderBy("c.createdAt", "desc")
            .limit(limit * 3)
            .execute();
          const distinct = [
            ...new Set(rows.flatMap((row) => (row.imageId === null ? [] : [row.imageId]))),
          ];
          return [collectionId, distinct.slice(0, limit)] as const;
        }),
      );
      return new Map(previews);
    },

    async cardIdsForPrintings(printingIds: readonly string[]): Promise<Map<string, string>> {
      if (printingIds.length === 0) {
        return new Map();
      }
      const rows = await db
        .selectFrom("printings")
        .select(["id", "cardId"])
        .where("id", "in", [...printingIds])
        .execute();
      return new Map(rows.map((row) => [row.id, row.cardId]));
    },
  };
}
