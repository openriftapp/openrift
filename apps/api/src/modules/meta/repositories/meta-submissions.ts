import { META_USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/meta-submissions";
import type { MetaEventFieldEdits } from "@openrift/shared/types/api/meta";
import type {
  MetaSubmissionKind,
  MetaSubmissionReason,
  MetaSubmissionStatus,
} from "@openrift/shared/types/enums";
import type { Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { MetaEventsTable, MetaSubmissionsTable } from "../../../db/tables/meta.js";
import { keyBatches } from "../../../lib/bind-batches.js";
import { inTransaction, listOwnedByUser } from "../../../repositories/query-helpers.js";
import { metaCreditsRepo } from "./meta-credits.js";

export type MetaSubmissionRow = Selectable<MetaSubmissionsTable>;

export interface MetaSubmissionInsert {
  userId: string;
  provider: string;
  externalId: string;
  /** Null on an event correction, which stages no player overlay. */
  playerOverlayId: string | null;
  /** The live event the submission targets, or null when it proposes one. */
  metaEventId: string | null;
  metaEventPlayerId?: string | null;
  /** What the submitter called the event, so the row still reads without a target. */
  eventName: string;
  /** Null on an event correction, which names no player. */
  playerName: string | null;
  kind: MetaSubmissionKind;
  /** The proposed new values, on an event correction and nowhere else. */
  fieldEdits?: MetaEventFieldEdits | null;
  note: string | null;
}

export interface MetaPendingSubmissionRow {
  id: string;
  userId: string;
  kind: MetaSubmissionKind;
  metaEventPlayerId: string | null;
  playerName: string | null;
  rank: number | null;
  rankIsTier: boolean | null;
}

/** The event fields a correction can propose a value for, as they stand today. */
type CorrectedEventColumns = Pick<
  Selectable<MetaEventsTable>,
  | "id"
  | "slug"
  | "name"
  | "eventDate"
  | "format"
  | "playerCount"
  | "organizer"
  | "location"
  | "country"
>;

/** One unresolved event correction beside the event it is about. */
export interface MetaEventCorrectionRow {
  submission: MetaSubmissionRow;
  /** Null when the event was deleted after the correction was sent. */
  event: CorrectedEventColumns | null;
}

/**
 * The outcome ledger for user decklist submissions to the meta archive, shaped like `card_submissions`.
 * An event correction writes no overlay row; the event name is snapshotted, not joined.
 */
export function metaSubmissionsRepo(db: Kysely<Database>) {
  return {
    /**
     * Record a new submission. Called inside the submission transaction so a
     * candidate player never exists without its ledger row.
     */
    async insert(values: MetaSubmissionInsert): Promise<string> {
      const row = await db
        .insertInto("metaSubmissions")
        .values(values)
        .returning("id")
        .executeTakeFirstOrThrow();
      return row.id;
    },

    /**
     * Newest first, keyset-paginated on `(user_id, created_at DESC, id DESC)`.
     * Returns up to `limit + 1` rows so the caller can detect a next page.
     */
    listByUser(
      userId: string,
      options: { cursor?: string | null; limit: number },
    ): Promise<MetaSubmissionRow[]> {
      return listOwnedByUser<MetaSubmissionRow>(db, "metaSubmissions", userId, options);
    },

    pendingForEvent(metaEventId: string): Promise<MetaPendingSubmissionRow[]> {
      return db
        .selectFrom("metaSubmissions")
        .leftJoin(
          "metaEventPlayerOverlays",
          "metaEventPlayerOverlays.id",
          "metaSubmissions.playerOverlayId",
        )
        .select([
          "metaSubmissions.id",
          "metaSubmissions.userId",
          "metaSubmissions.kind",
          "metaSubmissions.metaEventPlayerId",
          "metaSubmissions.playerName",
          "metaEventPlayerOverlays.rank",
          "metaEventPlayerOverlays.rankIsTier",
        ])
        .where("metaSubmissions.metaEventId", "=", metaEventId)
        .where("metaSubmissions.status", "=", "pending")
        .orderBy("metaSubmissions.createdAt", "asc")
        .orderBy("metaSubmissions.id", "asc")
        .execute();
    },

    /**
     * Permalink slugs for the given deck ids. A deck with no token is absent
     * from the map.
     */
    async shareTokensForDecks(deckIds: readonly string[]): Promise<Map<string, string>> {
      const rows: { id: string; shareToken: string }[] = [];
      for (const batch of keyBatches(deckIds)) {
        rows.push(
          ...(await db
            .selectFrom("decks")
            .select(["id", "shareToken"])
            .where("id", "in", batch)
            .where("shareToken", "is not", null)
            .$narrowType<{ shareToken: string }>()
            .execute()),
        );
      }
      return new Map(rows.map((row) => [row.id, row.shareToken]));
    },

    /**
     * Every unresolved correction to an event's own facts, oldest first, each
     * beside the event as it stands today, or null once the event was deleted.
     */
    async listPendingEventCorrections(limit: number): Promise<MetaEventCorrectionRow[]> {
      const submissions = await db
        .selectFrom("metaSubmissions")
        .selectAll()
        .where("kind", "=", "event_correction")
        .where("status", "=", "pending")
        .orderBy("createdAt", "asc")
        .orderBy("id", "asc")
        .limit(limit)
        .execute();
      const eventIds = [
        ...new Set(
          submissions.flatMap((row) => (row.metaEventId === null ? [] : [row.metaEventId])),
        ),
      ];
      const events =
        eventIds.length === 0
          ? []
          : await db
              .selectFrom("metaEvents")
              .select([
                "id",
                "slug",
                "name",
                "eventDate",
                "format",
                "playerCount",
                "organizer",
                "location",
                "country",
              ])
              .where("id", "in", eventIds)
              .execute();
      const eventById = new Map(events.map((event) => [event.id, event]));

      return submissions.map((submission) => ({
        submission,
        event:
          submission.metaEventId === null ? null : (eventById.get(submission.metaEventId) ?? null),
      }));
    },

    async byId(id: string): Promise<MetaSubmissionRow | null> {
      const row = await db
        .selectFrom("metaSubmissions")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ?? null;
    },

    /**
     * The submission behind one player overlay, or null when the overlay is
     * not a submission. This is how an accept finds the ledger entry to
     * resolve.
     */
    async byPlayerOverlayId(playerOverlayId: string): Promise<MetaSubmissionRow | null> {
      const row = await db
        .selectFrom("metaSubmissions")
        .selectAll()
        .where("playerOverlayId", "=", playerOverlayId)
        .executeTakeFirst();
      return row ?? null;
    },

    async byPlayerOverlayIds(playerOverlayIds: readonly string[]): Promise<MetaSubmissionRow[]> {
      const rows: MetaSubmissionRow[] = [];
      for (const batch of keyBatches(playerOverlayIds)) {
        rows.push(
          ...(await db
            .selectFrom("metaSubmissions")
            .selectAll()
            .where("playerOverlayId", "in", batch)
            .execute()),
        );
      }
      return rows;
    },

    /** The correction in `status` an event overlay was applied from. */
    async correctionForOverlay(
      overlay: { id: string },
      status: "accepted" | "rejected",
    ): Promise<MetaSubmissionRow | null> {
      const row = await db
        .selectFrom("metaSubmissions")
        .selectAll()
        .where("eventOverlayId", "=", overlay.id)
        .where("kind", "=", "event_correction")
        .where("status", "=", status)
        .orderBy("id", "asc")
        .executeTakeFirst();
      return row ?? null;
    },

    /**
     * Takes an accepted submission back to rejected and drops its credit, unless
     * another accepted contribution by the same person earns that same credit.
     */
    async revokeAcceptance(values: {
      submissionId: string;
      credit: { metaEventId: string; metaEventPlayerId: string | null; userId: string };
      resolvedAt: Date;
      reason: MetaSubmissionReason | null;
      note: string | null;
      resolvedByUserId: string | null;
    }): Promise<void> {
      const run = async (trx: Kysely<Database>): Promise<void> => {
        await trx
          .updateTable("metaSubmissions")
          .set({
            status: "rejected",
            resolvedAt: values.resolvedAt,
            resolutionReason: values.reason,
            resolutionNote: values.note,
            resolvedByUserId: values.resolvedByUserId,
            acceptedDeckId: null,
          })
          .where("id", "=", values.submissionId)
          .execute();

        // An entry accepted before promotion placed it was credited to the event,
        // and the event credit stands while any accepted contribution to the event does.
        const { metaEventId, metaEventPlayerId, userId } = values.credit;
        const keys = metaEventPlayerId === null ? [null] : [metaEventPlayerId, null];
        for (const playerId of keys) {
          const stillEarned =
            playerId === null
              ? sql`coalesce(o.meta_event_id, p.meta_event_id, s.meta_event_id) = ${metaEventId}::uuid`
              : sql`o.meta_event_player_id = ${playerId}::uuid`;
          await sql`
            delete from meta_credits mc
            where mc.meta_event_id = ${metaEventId}::uuid
              and mc.user_id = ${userId}
              and mc.meta_event_player_id is not distinct from ${playerId}::uuid
              and not exists (
                select 1
                from meta_submissions s
                left join meta_event_player_overlays o on o.id = s.player_overlay_id
                left join meta_event_players p on p.id = o.meta_event_player_id
                where s.user_id = ${userId}
                  and s.status = 'accepted'
                  and (${stillEarned})
              )
          `.execute(trx);
        }
      };
      await inTransaction(db, run);
    },

    /**
     * Stamp an outcome. `resolvedAt` is required by a CHECK for any non-pending
     * status, so it is not optional here either.
     */
    async resolve(
      id: string,
      values: {
        status: Exclude<MetaSubmissionStatus, "pending">;
        resolvedAt: Date;
        reason?: MetaSubmissionReason | null;
        note?: string | null;
        resolvedByUserId?: string | null;
        acceptedDeckId?: string | null;
      },
    ): Promise<void> {
      await db
        .updateTable("metaSubmissions")
        .set({
          status: values.status,
          resolvedAt: values.resolvedAt,
          resolutionReason: values.reason ?? null,
          resolutionNote: values.note ?? null,
          resolvedByUserId: values.resolvedByUserId ?? null,
          acceptedDeckId: values.acceptedDeckId ?? null,
        })
        .where("id", "=", id)
        .execute();
    },

    /**
     * Writes the credit and the submission's outcome in one transaction: a
     * crash between them must not leave one without the other.
     * `submissionId` is null when the contribution has no ledger row.
     */
    async recordAcceptance(values: {
      submissionId: string | null;
      credit: { metaEventId: string; metaEventPlayerId: string | null; userId: string };
      acceptedDeckId: string | null;
      resolvedAt: Date;
      resolvedByUserId: string | null;
      eventOverlayId?: string;
    }): Promise<void> {
      const run = async (trx: Kysely<Database>): Promise<void> => {
        await metaCreditsRepo(trx).insertCredit(values.credit);

        if (values.submissionId === null) {
          return;
        }
        // The reason and note are left alone: an admin may have written the
        // contributor a message before accepting, and an accept is not a
        // reason to drop it.
        await trx
          .updateTable("metaSubmissions")
          .set({
            status: "accepted",
            resolvedAt: values.resolvedAt,
            resolvedByUserId: values.resolvedByUserId,
            acceptedDeckId: values.acceptedDeckId,
            ...(values.eventOverlayId === undefined
              ? {}
              : { eventOverlayId: values.eventOverlayId }),
          })
          .where("id", "=", values.submissionId)
          .execute();
      };
      await inTransaction(db, run);
    },

    /**
     * Return a submission to the queue, for a misclicked reject. Clears the
     * accepted deck and applied correction but keeps any note the admin wrote.
     */
    async reopen(id: string): Promise<void> {
      await db
        .updateTable("metaSubmissions")
        .set({ status: "pending", resolvedAt: null, acceptedDeckId: null, eventOverlayId: null })
        .where("id", "=", id)
        .execute();
    },

    /**
     * How many of a user's own submissions are still awaiting an outcome, for
     * the per-user cap. Counts the ledger, not overlays: corrections write no
     * overlay row. Lists sent from a tournament do not count.
     */
    async countPendingByUser(userId: string): Promise<number> {
      const row = await db
        .selectFrom("metaSubmissions")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("userId", "=", userId)
        .where("provider", "=", META_USER_SUBMISSION_PROVIDER)
        .where("status", "=", "pending")
        .executeTakeFirst();
      return row ? Number(row.count) : 0;
    },
  };
}
