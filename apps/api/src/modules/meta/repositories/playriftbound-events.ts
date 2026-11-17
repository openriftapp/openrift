import type { MetaSyncBucketFilter } from "@openrift/shared/contracts/admin/meta-catalog";
import { DAY_MS } from "@openrift/shared/format-date";
import type { Kysely, RawBuilder, Selectable, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { PlayriftboundEventsTable } from "../../../db/tables/meta-sources.js";
import { keyBatches, rowBatches } from "../../../lib/bind-batches.js";
import { containsPattern } from "../../../lib/like-pattern.js";
import { PLAYRIFTBOUND_PROVIDER } from "../../../lib/meta-providers.js";
import { offsetPage } from "../../../repositories/query-helpers.js";
import type {
  PlayriftboundDeckSubmission,
  PlayriftboundDetailFacts,
  PlayriftboundEventProjection,
  PlayriftboundOrganizerProjection,
} from "../lib/playriftbound-catalog.js";
import { dueBefore } from "./meta-shared.js";
import type {
  MetaAutoPublishRule,
  MetaSyncBucketColumns,
  MetaSyncBucketCounts,
  MirrorHeldBy,
  MirrorListOrder,
  MirrorSyncOverview,
  MirrorTriage,
  MirrorTriageCounts,
} from "./meta-sync-buckets.js";
import {
  heldBySameStore,
  heldBySelection,
  catalogOrderBy,
  JOINED_TRIAGE,
  metaSyncBucketCondition,
  metaSyncBucketCountSelections,
  mirrorListConditions,
  mirrorOverviewSelections,
  narrowedBucketCounts,
  NEVER,
  pagedTriage,
  sizeRulePasses,
  toMirrorSyncOverview,
  TRIAGE_STATE,
  triageCountSelections,
} from "./meta-sync-buckets.js";
import type { MirrorUpsertResult } from "./mirror-upsert.js";
import { upsertMirrorRows } from "./mirror-upsert.js";

type PlayriftboundEventRow = Selectable<PlayriftboundEventsTable>;

export type PlayriftboundUpsertInput = PlayriftboundEventProjection;

export interface PlayriftboundTierInputRow {
  metaEventId: string;
  tournamentId: string;
  playerCount: number | null;
}

export interface PlayriftboundListRow extends PlayriftboundEventRow {
  triage: MirrorTriage;
  metaEventId: string | null;
  metaEventSlug: string | null;
  organizerName: string | null;
  organizerCity: string | null;
  organizerAddress: string | null;
  organizerLongitude: number | null;
  nextCheckAt: Date | null;
  checkStage: number;
  stagedPlayerCount: number;
  stagedMatchCount: number;
  heldBy: MirrorHeldBy | null;
}

export interface PlayriftboundRecheckRow extends PlayriftboundListRow {
  important: boolean;
  failingSince: Date | null;
}

export interface PlayriftboundListFilters {
  search?: string;
  tournamentType?: string;
  format?: string;
  triage?: MirrorTriage;
  minPlayers?: number;
  /** `YYYY-MM-DD`, inclusive, compared against the UTC day of `start_at`. */
  dateFrom?: string;
  dateTo?: string;
  missing?: boolean;
  bucket?: { name: MetaSyncBucketFilter; rule: MetaAutoPublishRule };
}

const KEY = sql<string>`c.tournament_id`;

export function playriftboundEventsRepo(db: Kysely<Database>) {
  /** Joined once and reused by the reads, so they can never disagree about what "accepted" means. */
  function triagedQuery() {
    return db
      .selectFrom("playriftboundEvents as c")
      .leftJoin("metaEventSources as src", (join) =>
        join
          .on("src.provider", "=", PLAYRIFTBOUND_PROVIDER)
          .onRef("src.externalId", "=", "c.tournamentId"),
      )
      .leftJoin("metaEvents as me", "me.id", "src.metaEventId")
      .leftJoin("ignoredMetaSourceEvents as i", (join) =>
        join
          .on("i.provider", "=", PLAYRIFTBOUND_PROVIDER)
          .onRef("i.externalId", "=", "c.tournamentId"),
      )
      .leftJoin("playriftboundOrganizers as o", "o.id", "c.organizerId")
      .leftJoin("playriftboundEventChecks as ck", "ck.tournamentId", "c.tournamentId");
  }

  const joinedColumns = [
    sql<string | null>`o.name`.as("organizerName"),
    sql<string | null>`o.city`.as("organizerCity"),
    sql<string | null>`o.address`.as("organizerAddress"),
    sql<number | null>`o.longitude`.as("organizerLongitude"),
    sql<Date | null>`ck.next_check_at`.as("nextCheckAt"),
    sql<number>`coalesce(ck.check_stage, 0)`.as("checkStage"),
  ];

  const stagedPlayerCount = sql<number>`(
    select count(*)::int from playriftbound_event_standings st
     where st.tournament_id = c.tournament_id
  )`;

  const stagedMatchCount = sql<number>`(
    select count(*)::int from playriftbound_event_matches m
     where m.tournament_id = c.tournament_id
  )`;

  const bucketColumns: MetaSyncBucketColumns = {
    started: sql<SqlBool>`c.start_at <= now()`,
    startAt: sql<Date | null>`c.start_at`,
    hasResults: sql<SqlBool>`coalesce(c.rounds_played, 0) > 0`,
    nextCheckAt: sql<Date | null>`ck.next_check_at`,
    passes: (rule) =>
      sizeRulePasses(
        sql<number | null>`c.registered_count`,
        sql<SqlBool>`coalesce(c.player_format <> 'ONE_V_ONE', false)`,
        rule.autoAcceptMinPlayers,
      ),
    held: heldBySameStore(PLAYRIFTBOUND_PROVIDER, KEY),
  };

  const paged = pagedTriage(PLAYRIFTBOUND_PROVIDER, KEY);

  function listSelect(rule?: MetaAutoPublishRule) {
    return triagedQuery()
      .selectAll("c")
      .select([
        TRIAGE_STATE.as("triage"),
        "src.metaEventId as metaEventId",
        "me.slug as metaEventSlug",
        stagedPlayerCount.as("stagedPlayerCount"),
        stagedMatchCount.as("stagedMatchCount"),
        heldBySelection(PLAYRIFTBOUND_PROVIDER, KEY, bucketColumns, rule),
        ...joinedColumns,
      ]);
  }

  function narrowing(filters: PlayriftboundListFilters): RawBuilder<SqlBool>[] {
    const conditions: RawBuilder<SqlBool>[] = [];
    if (filters.search !== undefined && filters.search.trim() !== "") {
      const like = containsPattern(filters.search.trim());
      conditions.push(
        sql<SqlBool>`(c.name ilike ${like} or o.name ilike ${like} or o.city ilike ${like})`,
      );
    }
    if (filters.tournamentType !== undefined) {
      conditions.push(sql<SqlBool>`c.tournament_type = ${filters.tournamentType}`);
    }
    if (filters.format !== undefined) {
      conditions.push(sql<SqlBool>`c.format = ${filters.format}`);
    }
    if (filters.minPlayers !== undefined) {
      conditions.push(sql<SqlBool>`c.registered_count >= ${filters.minPlayers}`);
    }
    if (filters.dateFrom !== undefined) {
      conditions.push(sql<SqlBool>`c.start_at >= ${filters.dateFrom}::date`);
    }
    if (filters.dateTo !== undefined) {
      conditions.push(sql<SqlBool>`c.start_at < ${filters.dateTo}::date + interval '1 day'`);
    }
    if (filters.missing === true) {
      conditions.push(sql<SqlBool>`c.missing_since is not null`);
    }
    return conditions;
  }

  return {
    async upsertOrganizers(organizers: readonly PlayriftboundOrganizerProjection[]): Promise<void> {
      const byId = new Map<string, PlayriftboundOrganizerProjection>();
      for (const row of organizers) {
        if (row.latitude !== null || (byId.get(row.id)?.latitude ?? null) === null) {
          byId.set(row.id, row);
        }
      }
      for (const batch of rowBatches([...byId.values()])) {
        await db
          .insertInto("playriftboundOrganizers")
          .values(batch)
          .onConflict((oc) =>
            oc
              .column("id")
              .doUpdateSet({
                name: sql`excluded.name`,
                city: sql`coalesce(excluded.city, playriftbound_organizers.city)`,
                adminArea: sql`coalesce(excluded.admin_area, playriftbound_organizers.admin_area)`,
                address: sql`coalesce(excluded.address, playriftbound_organizers.address)`,
                latitude: sql`coalesce(excluded.latitude, playriftbound_organizers.latitude)`,
                longitude: sql`coalesce(excluded.longitude, playriftbound_organizers.longitude)`,
              })
              .where(
                sql<SqlBool>`(playriftbound_organizers.name, playriftbound_organizers.city,
                  playriftbound_organizers.admin_area, playriftbound_organizers.address,
                  playriftbound_organizers.latitude, playriftbound_organizers.longitude)
                is distinct from (excluded.name,
                  coalesce(excluded.city, playriftbound_organizers.city),
                  coalesce(excluded.admin_area, playriftbound_organizers.admin_area),
                  coalesce(excluded.address, playriftbound_organizers.address),
                  coalesce(excluded.latitude, playriftbound_organizers.latitude),
                  coalesce(excluded.longitude, playriftbound_organizers.longitude))`,
              ),
          )
          .execute();
      }
    },

    /** Where the stores we know of are; the crawl searches around each of them. */
    async organizerCoordinates(): Promise<{ latitude: number; longitude: number }[]> {
      const rows = await db
        .selectFrom("playriftboundOrganizers")
        .select(["latitude", "longitude"])
        .where("latitude", "is not", null)
        .where("longitude", "is not", null)
        .execute();
      return rows.map((row) => ({
        latitude: row.latitude as number,
        longitude: row.longitude as number,
      }));
    },

    /** Never writes the detail columns: the listing does not carry them. */
    async upsertBatch(
      rows: readonly PlayriftboundUpsertInput[],
      seenAt: Date,
    ): Promise<MirrorUpsertResult<string>> {
      return await upsertMirrorRows(
        rows.map((row) => ({ ...row, lastSeenAt: seenAt, missingSince: null })),
        {
          keyOf: (row) => row.tournamentId,
          write: async (batch) => {
            const written = await db
              .insertInto("playriftboundEvents")
              .values(batch)
              .onConflict((oc) =>
                oc
                  .column("tournamentId")
                  .doUpdateSet((eb) => ({
                    organizerId: eb.ref("excluded.organizerId"),
                    name: eb.ref("excluded.name"),
                    startAt: eb.ref("excluded.startAt"),
                    tournamentType: eb.ref("excluded.tournamentType"),
                    format: eb.ref("excluded.format"),
                    playerFormat: eb.ref("excluded.playerFormat"),
                    participantCapacity: eb.ref("excluded.participantCapacity"),
                    registeredCount: eb.ref("excluded.registeredCount"),
                    waitlistedCount: eb.ref("excluded.waitlistedCount"),
                    pricing: eb.ref("excluded.pricing"),
                    entryFeeCurrency: eb.ref("excluded.entryFeeCurrency"),
                    entryFeeMinor: eb.ref("excluded.entryFeeMinor"),
                    contentHash: eb.ref("excluded.contentHash"),
                    lastSeenAt: eb.ref("excluded.lastSeenAt"),
                    missingSince: eb.ref("excluded.missingSince"),
                  }))
                  .where(
                    sql<SqlBool>`playriftbound_events.content_hash is distinct from excluded.content_hash
                    or playriftbound_events.missing_since is not null`,
                  ),
              )
              .returning(["tournamentId", sql<boolean>`(xmax = 0)`.as("inserted")])
              .execute();
            return written.map((row) => ({ key: row.tournamentId, inserted: row.inserted }));
          },
          touch: async (keys) => {
            await db
              .updateTable("playriftboundEvents")
              .set({ lastSeenAt: seenAt })
              .where("tournamentId", "in", keys)
              .execute();
          },
        },
      );
    },

    /** Only events at a located store: the crawl searches nowhere else, so nothing else was missed. */
    async markMissing(params: {
      from: Date;
      to: Date;
      seenBefore: Date;
      at: Date;
    }): Promise<number> {
      const result = await db
        .updateTable("playriftboundEvents")
        .set({ missingSince: params.at })
        .where((eb) =>
          eb(
            "organizerId",
            "in",
            eb
              .selectFrom("playriftboundOrganizers")
              .select("id")
              .where("latitude", "is not", null)
              .where("longitude", "is not", null),
          ),
        )
        .where("startAt", ">=", params.from)
        .where("startAt", "<", dueBefore(params.to))
        .where(sql<SqlBool>`date_trunc('milliseconds', last_seen_at) < ${params.seenBefore}`)
        .where("missingSince", "is", null)
        .executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0n);
    },

    async setDetailFacts(
      tournamentId: string,
      facts: PlayriftboundDetailFacts,
      fetchedAt: Date,
    ): Promise<void> {
      await db
        .updateTable("playriftboundEvents")
        .set({
          resultsFetchedAt: fetchedAt,
          structure: facts.structure,
          matchFormat: facts.matchFormat,
          roundCount: facts.roundCount,
          roundsPlayed: facts.roundsPlayed,
          roundsFinalized: facts.roundsFinalized,
          sourceUpdatedAt: facts.sourceUpdatedAt,
          deckSubmissionPolicy: facts.deckSubmissionPolicy,
          deckSubmissionDueAt: facts.deckSubmissionDueAt,
        })
        .where("tournamentId", "=", tournamentId)
        .execute();
    },

    /** Null records the read without a policy, so the event is not read again. */
    async setDeckSubmission(
      tournamentId: string,
      deckSubmission: PlayriftboundDeckSubmission | null,
      readAt: Date,
    ): Promise<void> {
      await db
        .updateTable("playriftboundEvents")
        .set({ ...deckSubmission, deckPolicyReadAt: readAt })
        .where("tournamentId", "=", tournamentId)
        .execute();
    },

    async upcomingWithoutDeckPolicy(now: Date, limit: number): Promise<string[]> {
      const rows = await db
        .selectFrom("playriftboundEvents")
        .select("tournamentId")
        .where("startAt", ">", now)
        .where("missingSince", "is", null)
        .where("deckPolicyReadAt", "is", null)
        .orderBy("startAt", "asc")
        .limit(limit)
        .execute();
      return rows.map((row) => row.tournamentId);
    },

    async byKey(tournamentId: string): Promise<PlayriftboundListRow | undefined> {
      return await listSelect().where("c.tournamentId", "=", tournamentId).executeTakeFirst();
    },

    /** The field promotion counts: ranked standings once held, registrations before. */
    tierInputsForLiveEvents(): Promise<PlayriftboundTierInputRow[]> {
      return db
        .selectFrom("playriftboundEvents as e")
        .innerJoin("metaEventSources as s", (join) =>
          join
            .on("s.provider", "=", PLAYRIFTBOUND_PROVIDER)
            .onRef("s.externalId", "=", "e.tournamentId"),
        )
        .select([
          "s.metaEventId",
          "e.tournamentId",
          sql<number | null>`coalesce(
            (select nullif(count(*), 0)::int from playriftbound_event_standings st
              where st.tournament_id = e.tournament_id and st.rank is not null),
            e.registered_count
          )`.as("playerCount"),
        ])
        .execute();
    },

    list(
      filters: PlayriftboundListFilters,
      pagination: { limit: number; offset: number },
      order: MirrorListOrder = {},
      rule?: MetaAutoPublishRule,
    ): Promise<{ rows: PlayriftboundListRow[]; total: number }> {
      let query = listSelect(rule)
        .orderBy(catalogOrderBy(sql`c.registered_count`, order))
        // Stores schedule weekly nights at the same hour, so start times tie
        // often; the key breaks them and keeps paging stable.
        .orderBy("c.tournamentId", "desc");
      for (const condition of mirrorListConditions(
        narrowing(filters),
        filters,
        bucketColumns,
        paged,
      )) {
        query = query.where(condition);
      }
      return offsetPage(query, pagination);
    },

    async dueForRecheck(now: Date, limit: number): Promise<PlayriftboundRecheckRow[]> {
      const important = sql<boolean>`coalesce(me.tier in ('premier', 'competitive'), false)`;
      return await listSelect()
        .select([important.as("important"), "ck.failingSince"])
        .where("ck.nextCheckAt", "is not", null)
        .where("ck.nextCheckAt", "<", dueBefore(now))
        .orderBy(sql`${important} desc`)
        .orderBy("ck.nextCheckAt", "asc")
        .limit(limit)
        .execute();
    },

    /** Pulls running events, those started in the last three days and still on stage 0, to now. */
    async rearmRunningEvents(now: Date): Promise<number> {
      const since = new Date(now.getTime() - 3 * DAY_MS);
      const result = await db
        .updateTable("playriftboundEventChecks as ck")
        .set({ nextCheckAt: now })
        .where("ck.checkStage", "=", 0)
        .where(sql<SqlBool>`date_trunc('milliseconds', ck.next_check_at) > ${now}`)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("playriftboundEvents as e")
              .select("e.tournamentId")
              .whereRef("e.tournamentId", "=", "ck.tournamentId")
              .where(sql<SqlBool>`date_trunc('milliseconds', e.start_at) <= ${now}`)
              .where(sql<SqlBool>`date_trunc('milliseconds', e.start_at) >= ${since}`),
          ),
        )
        .executeTakeFirst();
      return Number(result.numUpdatedRows);
    },

    async setRecheck(
      tournamentId: string,
      values: { nextCheckAt: Date | null; checkStage: number; failingSince?: Date | null },
    ): Promise<void> {
      await db
        .insertInto("playriftboundEventChecks")
        .values({ tournamentId, ...values })
        .onConflict((oc) => oc.column("tournamentId").doUpdateSet(values))
        .execute();
    },

    async clearFailing(tournamentId: string): Promise<void> {
      await db
        .updateTable("playriftboundEventChecks")
        .set({ failingSince: null })
        .where("tournamentId", "=", tournamentId)
        .execute();
    },

    async newKeys(): Promise<string[]> {
      const rows = await triagedQuery()
        .select("c.tournamentId")
        .where(JOINED_TRIAGE.undecided)
        .orderBy("c.startAt", "desc")
        .execute();
      return rows.map((row) => row.tournamentId);
    },

    async unacceptedByKeys(tournamentIds: readonly string[]): Promise<PlayriftboundListRow[]> {
      const rows: PlayriftboundListRow[] = [];
      for (const batch of keyBatches(tournamentIds)) {
        rows.push(
          ...(await listSelect()
            .where("c.tournamentId", "in", batch)
            .where(JOINED_TRIAGE.undecided)
            .execute()),
        );
      }
      return rows;
    },

    async syncOverview(rule: MetaAutoPublishRule): Promise<MirrorSyncOverview> {
      const row = await triagedQuery()
        .select(
          mirrorOverviewSelections(bucketColumns, rule, {
            // The source has no finished flag; a fully finalized event is the
            // closest "results exist" signal.
            completed: sql<SqlBool>`c.rounds_played > 0 and c.rounds_finalized = c.rounds_played`,
            // The source publishes no decklists.
            decklistPublished: NEVER,
            awaitingResults: sql<SqlBool>`c.results_fetched_at is null`,
            cancelled: NEVER,
          }),
        )
        .executeTakeFirstOrThrow();
      return toMirrorSyncOverview(row);
    },

    async passingNoResultsKeys(rule: MetaAutoPublishRule): Promise<string[]> {
      const rows = await triagedQuery()
        .select(sql<string>`c.tournament_id`.as("key"))
        .where(metaSyncBucketCondition("passingNoResults", bucketColumns, rule, paged))
        .execute();
      return rows.map((row) => row.key);
    },

    bucketCounts(
      filters: PlayriftboundListFilters,
      rule: MetaAutoPublishRule,
    ): Promise<MetaSyncBucketCounts | null> {
      return narrowedBucketCounts(narrowing(filters), (narrowed) =>
        triagedQuery()
          .select(metaSyncBucketCountSelections(bucketColumns, rule))
          .where(narrowed)
          .executeTakeFirstOrThrow(),
      );
    },

    async triageCounts(): Promise<MirrorTriageCounts> {
      return await triagedQuery().select(triageCountSelections()).executeTakeFirstOrThrow();
    },
  };
}
