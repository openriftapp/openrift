import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import { AUTO_COMPLETE_GRACE_MS } from "@openrift/shared/tournament-lifecycle";
import type { PodScoringScheme } from "@openrift/shared/types/api/pod-tournament";
import type {
  TournamentDeckPhase,
  TournamentDeckSubmission,
  TournamentFormat,
  TournamentHostType,
  TournamentListLockMode,
  TournamentMatchFormat,
  TournamentPairingStyle,
  TournamentPlayMode,
  TournamentStatus,
} from "@openrift/shared/types/api/tournament";
import type { ExpressionBuilder, Kysely, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { TournamentsTable } from "../../../db/tables/tournaments.js";
import { keysetCursorPredicate } from "../../../repositories/query-helpers.js";
import { lockTournamentWrites } from "./tournaments-shared.js";
import type { Tournament } from "./tournaments-shared.js";

export interface NewTournament {
  hostType: TournamentHostType;
  hostUserId?: string | null;
  hostOrgId?: string | null;
  groupId?: string | null;
  isPublished?: boolean;
  name: string;
  status?: TournamentStatus;
  /** Omit to fall back to the DB default of now(); the wizard always sets it. */
  startsAt?: Date;
  /** Optional end instant: a multi-day close, or null for a single-day event. */
  endsAt?: Date | null;
  pairingStyle: TournamentPairingStyle;
  /** 1v1 or 2v2 team play; omit for the DB default of 1v1. */
  playMode?: TournamentPlayMode;
  scoringScheme?: PodScoringScheme;
  byePoints?: number;
  matchFormat?: TournamentMatchFormat;
  winPoints?: number;
  drawPoints?: number;
  hasRegions?: boolean;
  format?: TournamentFormat;
  cutSize?: CutSize;
  hasCutRematchAvoidance?: boolean;
  hasLegendTiebreak?: boolean;
  hasSelfPacedGroups?: boolean;
  deckSubmission: TournamentDeckSubmission;
  deckPhase?: TournamentDeckPhase;
  submissionsCloseAt?: Date | null;
  listLockMode?: TournamentListLockMode;
  deckFormat?: string;
  allowedSets?: string[] | null;
  hasSelfRegistration?: boolean;
}

/** Editable umbrella settings (re-validated against the CHECK invariants by the route). */
export interface TournamentPatch {
  name?: string;
  status?: TournamentStatus;
  /** Host reassignment. Set all three together to keep the host CHECK satisfied. */
  hostType?: TournamentHostType;
  hostUserId?: string | null;
  hostOrgId?: string | null;
  /** The pairing engine. The route guards that it only changes before any round. */
  pairingStyle?: TournamentPairingStyle;
  /** The play mode. The route guards that it only changes before any round. */
  playMode?: TournamentPlayMode;
  startsAt?: Date;
  endsAt?: Date | null;
  groupId?: string | null;
  isPublished?: boolean;
  scoringScheme?: PodScoringScheme;
  byePoints?: number;
  /** The Swiss result-entry format. The route guards that it only changes before any round. */
  matchFormat?: TournamentMatchFormat;
  winPoints?: number;
  drawPoints?: number;
  hasRegions?: boolean;
  format?: TournamentFormat;
  cutSize?: CutSize;
  hasCutRematchAvoidance?: boolean;
  hasLegendTiebreak?: boolean;
  hasSelfPacedGroups?: boolean;
  deckSubmission?: TournamentDeckSubmission;
  deckPhase?: TournamentDeckPhase;
  submissionsCloseAt?: Date | null;
  listLockMode?: TournamentListLockMode;
  deckFormat?: string;
  allowedSets?: string[] | null;
  hasSelfRegistration?: boolean;
  uvsgamesEventId?: string | null;
  playriftboundEventId?: string | null;
}

export interface TournamentSummaryRow extends Tournament {
  participantCount: number;
  pendingRequestCount: number;
}

export function tournamentsCoreRepo(db: Kysely<Database>) {
  return {
    async getById(id: string): Promise<Tournament | undefined> {
      const row = await db
        .selectFrom("tournaments")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row;
    },

    /** Call inside a transaction: serializes round edits of one tournament. */
    async lockRounds(id: string): Promise<void> {
      await lockTournamentWrites(db, id);
    },

    async listForGroup(groupId: string): Promise<Tournament[]> {
      const rows = await db
        .selectFrom("tournaments")
        .selectAll()
        .where("groupId", "=", groupId)
        .where("isPublished", "=", true)
        .orderBy("startsAt", "desc")
        .orderBy("createdAt", "desc")
        .execute();
      return rows;
    },

    async listForGroupWithCounts(groupId: string): Promise<TournamentSummaryRow[]> {
      const rows = await withSummaryCounts(db.selectFrom("tournaments as t"))
        .where("t.groupId", "=", groupId)
        .orderBy("t.startsAt", "desc")
        .orderBy("t.createdAt", "desc")
        .execute();
      return rows.map((row) => toSummaryRow(row));
    },

    async create(values: NewTournament): Promise<Tournament> {
      const { status, allowedSets, ...rest } = values;
      const row = await db
        .insertInto("tournaments")
        .values({
          ...rest,
          ...(status === undefined ? {} : { status }),
          allowedSets,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return row;
    },

    async updateSettings(id: string, patch: TournamentPatch): Promise<Tournament | undefined> {
      const { status, allowedSets, ...rest } = patch;
      const row = await db
        .updateTable("tournaments")
        .set({
          ...rest,
          ...(status === undefined ? {} : { status }),
          ...(allowedSets === undefined ? {} : { allowedSets }),
          updatedAt: new Date(),
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      return row;
    },

    /** Leaves a completed or cancelled tournament as it is. */
    async completeIfOpen(id: string): Promise<void> {
      await db
        .updateTable("tournaments")
        .set({ status: "completed", updatedAt: new Date() })
        .where("id", "=", id)
        .where("status", "in", ["setup", "running"])
        .execute();
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db.deleteFrom("tournaments").where("id", "=", id).executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    async setSubmissionToken(id: string, token: string | null): Promise<Tournament | undefined> {
      const row = await db
        .updateTable("tournaments")
        .set({ submissionToken: token, updatedAt: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      return row;
    },

    async getBySubmissionToken(token: string): Promise<Tournament | undefined> {
      const row = await db
        .selectFrom("tournaments")
        .selectAll()
        .where("submissionToken", "=", token)
        .executeTakeFirst();
      return row;
    },

    async setReportToken(id: string, token: string | null): Promise<Tournament | undefined> {
      const row = await db
        .updateTable("tournaments")
        .set({ reportToken: token, updatedAt: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      return row;
    },

    async setFollowToken(id: string, token: string | null): Promise<Tournament | undefined> {
      const row = await db
        .updateTable("tournaments")
        .set({ followToken: token, updatedAt: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      return row;
    },

    /**
     * The caller decides write permission by comparing the matched token
     * against `reportToken` (read+write) vs `followToken` (read-only).
     */
    async getByShareToken(token: string): Promise<Tournament | undefined> {
      const row = await db
        .selectFrom("tournaments")
        .selectAll()
        .where((eb) => eb.or([eb("reportToken", "=", token), eb("followToken", "=", token)]))
        .executeTakeFirst();
      return row;
    },

    async getCounts(
      tournamentId: string,
    ): Promise<{ participantCount: number; pendingRequestCount: number }> {
      const row = await db
        .selectFrom("tournaments as t")
        .select(summaryCountColumns)
        .where("t.id", "=", tournamentId)
        .executeTakeFirst();
      return {
        participantCount: Number(row?.participantCount ?? 0),
        pendingRequestCount: Number(row?.pendingRequestCount ?? 0),
      };
    },

    async hasRounds(tournamentId: string): Promise<boolean> {
      const row = await db
        .selectFrom("podRounds")
        .select("id")
        .where("tournamentId", "=", tournamentId)
        .limit(1)
        .executeTakeFirst();
      return row !== undefined;
    },

    async listForUserByPlayriftboundEvent(
      userId: string,
      orgIds: string[],
      eventId: string,
    ): Promise<TournamentSummaryRow[]> {
      const rows = await withSummaryCounts(forUser(db, userId, orgIds))
        .where("t.playriftboundEventId", "=", eventId)
        .orderBy("t.startsAt", "desc")
        .execute();
      return rows.map((row) => toSummaryRow(row));
    },

    /** Every tournament of the user's that is not over yet; unpaged. */
    async listCurrentForUser(
      userId: string,
      orgIds: string[],
      now: Date,
    ): Promise<TournamentSummaryRow[]> {
      const rows = await withSummaryCounts(forUser(db, userId, orgIds))
        .where(sql<SqlBool>`not ${isOver(now)}`)
        .orderBy("t.startsAt", "desc")
        .orderBy("t.createdAt", "desc")
        .execute();
      return rows.map((row) => toSummaryRow(row));
    },

    /**
     * Over tournaments, keyset paginated on `(starts_at desc, id desc)`.
     * Returns up to `limit + 1` rows so the caller can detect a next page.
     */
    async listPastForUser(
      userId: string,
      orgIds: string[],
      now: Date,
      options: { cursor?: string | null; limit: number },
    ): Promise<TournamentSummaryRow[]> {
      let query = withSummaryCounts(forUser(db, userId, orgIds))
        .where(isOver(now))
        .orderBy("t.startsAt", "desc")
        .orderBy("t.id", "desc")
        .limit(options.limit + 1);
      if (options.cursor) {
        query = query.where(
          keysetCursorPredicate(options.cursor, {
            timeColumn: "t.startsAt",
            idColumn: "t.id",
            idDirection: "desc",
          }),
        );
      }
      const rows = await query.execute();
      return rows.map((row) => toSummaryRow(row));
    },

    async countPastForUser(userId: string, orgIds: string[], now: Date): Promise<number> {
      const row = await forUser(db, userId, orgIds)
        .where(isOver(now))
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .executeTakeFirst();
      return Number(row?.count ?? 0);
    },
  };
}

/** Hosted by the user or one of `orgIds`, staffed by the user, or played by the user. */
function forUser(db: Kysely<Database>, userId: string, orgIds: string[]) {
  return db
    .selectFrom("tournaments as t")
    .where((eb) =>
      eb.or([
        eb.and([eb("t.hostType", "=", "user"), eb("t.hostUserId", "=", userId)]),
        orgIds.length > 0 ? eb("t.hostOrgId", "in", orgIds) : eb.val(false),
        eb.exists(
          eb
            .selectFrom("tournamentStaff as s")
            .select("s.userId")
            .whereRef("s.tournamentId", "=", "t.id")
            .where("s.userId", "=", userId),
        ),
        eb.exists(
          eb
            .selectFrom("tournamentParticipants as p")
            .select("p.id")
            .whereRef("p.tournamentId", "=", "t.id")
            .where("p.userId", "=", userId),
        ),
      ]),
    );
}

function summaryCountColumns(eb: ExpressionBuilder<Database & { t: TournamentsTable }, "t">) {
  return [
    eb
      .selectFrom("tournamentParticipants as p")
      .select(eb.fn.countAll<number>().as("c"))
      .whereRef("p.tournamentId", "=", "t.id")
      .as("participantCount"),
    eb
      .selectFrom("tournamentParticipants as p")
      .select(eb.fn.countAll<number>().as("c"))
      .whereRef("p.tournamentId", "=", "t.id")
      .where("p.status", "=", "requested")
      .as("pendingRequestCount"),
  ] as const;
}

function withSummaryCounts(query: ReturnType<typeof forUser>) {
  return query.selectAll("t").select(summaryCountColumns);
}

/** SQL twin of `effectiveTournamentState` reaching "completed" or "cancelled". */
function isOver(now: Date) {
  return sql<SqlBool>`(
    t.status in ('completed', 'cancelled')
    or date_trunc(
      'milliseconds',
      coalesce(t.ends_at, t.starts_at + ${AUTO_COMPLETE_GRACE_MS}::int * interval '1 millisecond')
    ) <= ${now}
  )`;
}

function toSummaryRow<
  T extends { participantCount: number | null; pendingRequestCount: number | null },
>(row: T): T & { participantCount: number; pendingRequestCount: number } {
  return {
    ...row,
    participantCount: Number(row.participantCount ?? 0),
    pendingRequestCount: Number(row.pendingRequestCount ?? 0),
  };
}
