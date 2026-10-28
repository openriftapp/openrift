import type { MetaSyncBucketFilter } from "@openrift/shared/contracts/admin/meta-catalog";
import type { Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { PlayriftboundEventsTable } from "../../../db/tables/meta-sources.js";
import { keyBatches, rowBatches } from "../../../lib/bind-batches.js";
import { containsPattern } from "../../../lib/like-pattern.js";
import { PLAYRIFTBOUND_PROVIDER } from "../../../lib/meta-providers.js";
import { offsetPage } from "../../../repositories/query-helpers.js";
import type {
  PlayriftboundDetailFacts,
  PlayriftboundEventProjection,
  PlayriftboundOrganizerProjection,
} from "../lib/playriftbound-catalog.js";
import type { MetaSyncBucketColumns, MetaSyncBuckets } from "./meta-sync-buckets.js";
import {
  metaSyncBucketFilter,
  metaSyncBucketSelections,
  passingNoResultsFilter,
  toMetaSyncBuckets,
} from "./meta-sync-buckets.js";

type PlayriftboundEventRow = Selectable<PlayriftboundEventsTable>;

export type PlayriftboundUpsertInput = PlayriftboundEventProjection;

export interface PlayriftboundUpsertResult {
  inserted: string[];
  changed: string[];
  unchanged: string[];
}

export type PlayriftboundTriage = "new" | "accepted" | "dismissed";

export interface PlayriftboundTierInputRow {
  metaEventId: string;
  tournamentId: string;
  playerCount: number | null;
}

export interface PlayriftboundListRow extends PlayriftboundEventRow {
  triage: PlayriftboundTriage;
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
}

export interface PlayriftboundRecheckRow extends PlayriftboundListRow {
  important: boolean;
  failingSince: Date | null;
}

export interface PlayriftboundTriageCounts {
  new: number;
  accepted: number;
  dismissed: number;
}

export interface PlayriftboundListFilters {
  search?: string;
  tournamentType?: string;
  format?: string;
  triage?: PlayriftboundTriage;
  minPlayers?: number;
  /** `YYYY-MM-DD`, inclusive, compared against the UTC day of `start_at`. */
  dateFrom?: string;
  dateTo?: string;
  missing?: boolean;
  bucket?: MetaSyncBucketFilter;
  awaitingResults?: boolean;
}

/** Defaults to newest events first. */
export interface PlayriftboundListOrder {
  sort?: "startAt" | "name" | "playerCount";
  direction?: "asc" | "desc";
}

type SqlBool = boolean;

const CATALOG_ORDER_COLUMNS = {
  startAt: sql`c.start_at`,
  name: sql`lower(c.name)`,
  playerCount: sql`c.registered_count`,
};

/** Nulls sort last whichever way the column runs. */
function catalogOrderBy(order: PlayriftboundListOrder) {
  const column = CATALOG_ORDER_COLUMNS[order.sort ?? "startAt"];
  return order.direction === "asc" ? sql`${column} asc nulls last` : sql`${column} desc nulls last`;
}

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

  const triage = sql<PlayriftboundTriage>`case
    when i.provider is not null then 'dismissed'
    when src.meta_event_id is not null then 'accepted'
    else 'new'
  end`;

  const notFetched = sql<SqlBool>`c.results_fetched_at is null`;

  const stagedPlayerCount = sql<number>`(
    select count(*)::int from playriftbound_event_standings st
     where st.tournament_id = c.tournament_id
  )`;

  const stagedMatchCount = sql<number>`(
    select count(*)::int from playriftbound_event_matches m
     where m.tournament_id = c.tournament_id
  )`;

  const isNew = sql<SqlBool>`i.provider is null and src.meta_event_id is null`;
  const accepted = sql<SqlBool>`i.provider is null and src.meta_event_id is not null`;
  const bucketColumns: MetaSyncBucketColumns = {
    started: sql<SqlBool>`c.start_at <= now()`,
    startAt: sql<Date | null>`c.start_at`,
    hasResults: sql<SqlBool>`coalesce(c.rounds_played, 0) > 0`,
    nextCheckAt: sql<Date | null>`ck.next_check_at`,
    players: sql<number | null>`c.registered_count`,
    team: sql<SqlBool>`coalesce(c.player_format <> 'ONE_V_ONE', false)`,
  };

  // Absence must be an anti-join here: reading a joined null makes the planner
  // sort the whole catalogue before taking one page. Presence reads the join.
  const notDismissed = sql<SqlBool>`not exists (
    select 1 from ignored_meta_source_events x
     where x.provider = ${PLAYRIFTBOUND_PROVIDER} and x.external_id = c.tournament_id
  )`;
  const notLinked = sql<SqlBool>`not exists (
    select 1 from meta_event_sources y
     where y.provider = ${PLAYRIFTBOUND_PROVIDER} and y.external_id = c.tournament_id
       and y.meta_event_id is not null
  )`;
  const pagedNew = sql<SqlBool>`${notDismissed} and ${notLinked}`;
  const pagedAccepted = sql<SqlBool>`${notDismissed} and src.meta_event_id is not null`;
  const pagedDismissed = sql<SqlBool>`i.provider is not null`;

  function listSelect() {
    return triagedQuery()
      .selectAll("c")
      .select([
        triage.as("triage"),
        "src.metaEventId as metaEventId",
        "me.slug as metaEventSlug",
        stagedPlayerCount.as("stagedPlayerCount"),
        stagedMatchCount.as("stagedMatchCount"),
        ...joinedColumns,
      ]);
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
    ): Promise<PlayriftboundUpsertResult> {
      if (rows.length === 0) {
        return { inserted: [], changed: [], unchanged: [] };
      }
      const inserted: string[] = [];
      const changed: string[] = [];
      for (const batch of rowBatches(
        rows.map((row) => ({ ...row, lastSeenAt: seenAt, missingSince: null })),
      )) {
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

        for (const row of written) {
          (row.inserted ? inserted : changed).push(row.tournamentId);
        }
      }

      const touched = new Set([...inserted, ...changed]);
      const unchanged = rows.map((row) => row.tournamentId).filter((id) => !touched.has(id));
      for (const batch of keyBatches(unchanged)) {
        await db
          .updateTable("playriftboundEvents")
          .set({ lastSeenAt: seenAt })
          .where("tournamentId", "in", batch)
          .execute();
      }
      return { inserted, changed, unchanged };
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
        .where(sql<SqlBool>`date_trunc('milliseconds', start_at) >= ${params.from}`)
        .where(sql<SqlBool>`date_trunc('milliseconds', start_at) <= ${params.to}`)
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
        })
        .where("tournamentId", "=", tournamentId)
        .execute();
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
      order: PlayriftboundListOrder = {},
    ): Promise<{ rows: PlayriftboundListRow[]; total: number }> {
      const applyFilters = <T extends ReturnType<typeof triagedQuery>>(q: T): T => {
        let base = q;
        if (filters.search !== undefined && filters.search.trim() !== "") {
          const like = containsPattern(filters.search.trim());
          base = base.where((eb) =>
            eb.or([
              eb("c.name", "ilike", like),
              eb("o.name", "ilike", like),
              eb("o.city", "ilike", like),
            ]),
          ) as T;
        }
        if (filters.tournamentType !== undefined) {
          base = base.where("c.tournamentType", "=", filters.tournamentType) as T;
        }
        if (filters.format !== undefined) {
          base = base.where("c.format", "=", filters.format) as T;
        }
        if (filters.minPlayers !== undefined) {
          base = base.where("c.registeredCount", ">=", filters.minPlayers) as T;
        }
        if (filters.dateFrom !== undefined) {
          base = base.where(sql<SqlBool>`c.start_at >= ${filters.dateFrom}::date`) as T;
        }
        if (filters.dateTo !== undefined) {
          base = base.where(
            sql<SqlBool>`c.start_at < ${filters.dateTo}::date + interval '1 day'`,
          ) as T;
        }
        if (filters.bucket !== undefined && filters.minPlayers !== undefined) {
          base = base.where(
            metaSyncBucketFilter(filters.bucket, bucketColumns, filters.minPlayers),
          ) as T;
        }
        if (filters.missing === true) {
          base = base.where("c.missingSince", "is not", null) as T;
        }
        if (filters.awaitingResults === true) {
          base = base.where(pagedAccepted).where(notFetched) as T;
        }
        if (filters.triage === "new") {
          base = base.where(pagedNew) as T;
        } else if (filters.triage === "accepted") {
          base = base.where(pagedAccepted) as T;
        } else if (filters.triage === "dismissed") {
          base = base.where(pagedDismissed) as T;
        }
        return base;
      };

      return offsetPage(
        applyFilters(listSelect())
          .orderBy(catalogOrderBy(order))
          // Stores schedule weekly nights at the same hour, so start times tie
          // often; the key breaks them and keeps paging stable.
          .orderBy("c.tournamentId", "desc"),
        pagination,
      );
    },

    async dueForRecheck(now: Date, limit: number): Promise<PlayriftboundRecheckRow[]> {
      const important = sql<boolean>`coalesce(me.tier in ('premier', 'competitive'), false)`;
      return await listSelect()
        .select([important.as("important"), "ck.failingSince"])
        .where("ck.nextCheckAt", "is not", null)
        .where(sql<SqlBool>`date_trunc('milliseconds', ck.next_check_at) <= ${now}`)
        .orderBy(sql`${important} desc`)
        .orderBy("ck.nextCheckAt", "asc")
        .limit(limit)
        .execute();
    },

    /** Pulls running events, those started in the last three days and still on stage 0, to now. */
    async rearmRunningEvents(now: Date): Promise<number> {
      const since = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
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
        .where(isNew)
        .orderBy("c.startAt", "desc")
        .execute();
      return rows.map((row) => row.tournamentId);
    },

    async unacceptedByKeys(tournamentIds: readonly string[]): Promise<PlayriftboundListRow[]> {
      const rows: PlayriftboundListRow[] = [];
      for (const batch of keyBatches(tournamentIds)) {
        rows.push(
          ...(await listSelect().where("c.tournamentId", "in", batch).where(isNew).execute()),
        );
      }
      return rows;
    },

    async syncOverview(minPlayers: number | null): Promise<
      MetaSyncBuckets & {
        total: number;
        completed: number;
        decklistPublished: number;
        missing: number;
        dueRecheck: number;
        oldestDueAt: Date | null;
        queued: number;
        acceptedAwaitingResults: number;
        acceptedMissing: number;
        acceptedCancelled: number;
        lastSeenAt: Date | null;
      }
    > {
      const row = await triagedQuery()
        .select((eb) => [
          eb.fn.countAll<string>().as("total"),
          // The source has no finished flag; a fully finalized event is the
          // closest "results exist" signal.
          sql<string>`count(*) filter (where c.rounds_played > 0 and c.rounds_finalized = c.rounds_played)`.as(
            "completed",
          ),
          // The source publishes no decklists.
          sql<string>`0`.as("decklistPublished"),
          sql<string>`count(*) filter (where c.missing_since is not null)`.as("missing"),
          sql<string>`count(*) filter (where ck.next_check_at is not null and ck.next_check_at <= now())`.as(
            "dueRecheck",
          ),
          sql<Date | null>`min(ck.next_check_at) filter (where ck.next_check_at <= now())`.as(
            "oldestDueAt",
          ),
          sql<string>`count(*) filter (where ck.next_check_at is not null)`.as("queued"),
          sql<string>`count(*) filter (where (${accepted}) and c.results_fetched_at is null)`.as(
            "acceptedAwaitingResults",
          ),
          sql<string>`count(*) filter (where (${accepted}) and c.missing_since is not null)`.as(
            "acceptedMissing",
          ),
          eb.fn.max<Date | null>("c.lastSeenAt").as("lastSeenAt"),
          ...metaSyncBucketSelections(bucketColumns, minPlayers),
        ])
        .executeTakeFirstOrThrow();
      return {
        ...toMetaSyncBuckets(row),
        total: Number(row.total),
        completed: Number(row.completed),
        decklistPublished: Number(row.decklistPublished),
        missing: Number(row.missing),
        dueRecheck: Number(row.dueRecheck),
        oldestDueAt: row.oldestDueAt,
        queued: Number(row.queued),
        acceptedAwaitingResults: Number(row.acceptedAwaitingResults),
        acceptedMissing: Number(row.acceptedMissing),
        acceptedCancelled: 0,
        lastSeenAt: row.lastSeenAt,
      };
    },

    async passingNoResultsKeys(minPlayers: number): Promise<string[]> {
      const rows = await triagedQuery()
        .select(sql<string>`c.tournament_id`.as("key"))
        .where(passingNoResultsFilter(bucketColumns, minPlayers))
        .execute();
      return rows.map((row) => row.key);
    },

    async triageCounts(): Promise<PlayriftboundTriageCounts> {
      const row = await triagedQuery()
        .select([
          sql<number>`count(*) filter (where i.provider is null and src.meta_event_id is null)::int`.as(
            "new",
          ),
          sql<number>`count(*) filter (where i.provider is null and src.meta_event_id is not null)::int`.as(
            "accepted",
          ),
          sql<number>`count(*) filter (where i.provider is not null)::int`.as("dismissed"),
        ])
        .executeTakeFirstOrThrow();
      return {
        new: Number(row.new),
        accepted: Number(row.accepted),
        dismissed: Number(row.dismissed),
      };
    },
  };
}
