import type { MetaSyncBucketFilter } from "@openrift/shared/contracts/admin/meta-catalog";
import type { Kysely, RawBuilder, Selectable, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { TopdeckEventsTable } from "../../../db/tables/meta-sources.js";
import { keyBatches } from "../../../lib/bind-batches.js";
import { containsPattern } from "../../../lib/like-pattern.js";
import { TOPDECK_PROVIDER } from "../../../lib/meta-providers.js";
import { offsetPage } from "../../../repositories/query-helpers.js";
import type {
  MetaAutoPublishRule,
  MetaSyncBucketColumns,
  MetaSyncBucketCounts,
  MirrorListOrder,
  MirrorSyncOverview,
  MirrorTriage,
  MirrorTriageCounts,
} from "./meta-sync-buckets.js";
import {
  catalogOrderBy,
  JOINED_TRIAGE,
  metaSyncBucketCondition,
  metaSyncBucketCountSelections,
  narrowedBucketCounts,
  mirrorListConditions,
  mirrorOverviewSelections,
  NEVER,
  pagedTriage,
  sizeRulePasses,
  toMirrorSyncOverview,
  TRIAGE_STATE,
  triageCountSelections,
} from "./meta-sync-buckets.js";
import { cardsByShortCode } from "./mirror-results.js";
import type { MirrorUpsertResult } from "./mirror-upsert.js";
import { upsertMirrorRows } from "./mirror-upsert.js";

type TopdeckEventRow = Selectable<TopdeckEventsTable>;

/** The projection one search row upserts, minus the crawl bookkeeping. */
export interface TopdeckUpsertInput {
  tid: string;
  name: string;
  format: string;
  startAt: Date;
  swissRounds: number | null;
  topCut: number | null;
  playerCount: number | null;
  isTeamEvent: boolean;
  teamSize: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  longitude: number | null;
  latitude: number | null;
  contentHash: string;
}

export interface TopdeckTierInputRow {
  metaEventId: string;
  tid: string;
  playerCount: number | null;
}

export interface TopdeckListRow extends TopdeckEventRow {
  triage: MirrorTriage;
  metaEventId: string | null;
  metaEventSlug: string | null;
  fetchedAt: Date | null;
  stagedPlayerCount: number;
  stagedLegendCount: number;
  stagedDeckCount: number;
  rivalProvider: string | null;
}

export interface TopdeckListFilters {
  search?: string;
  format?: string;
  triage?: MirrorTriage;
  minPlayers?: number;
  dateFrom?: string;
  dateTo?: string;
  missing?: boolean;
  bucket?: { name: MetaSyncBucketFilter; rule: MetaAutoPublishRule };
}

const RESULTS_PENDING = "pending";
const KEY = sql<string>`c.tid`;

export function topdeckEventsRepo(db: Kysely<Database>) {
  /** Joined once and reused, so the reads cannot disagree about what "accepted" means. */
  function triagedQuery() {
    return db
      .selectFrom("topdeckEvents as c")
      .leftJoin("metaEventSources as src", (join) =>
        join.on("src.provider", "=", TOPDECK_PROVIDER).onRef("src.externalId", "=", "c.tid"),
      )
      .leftJoin("metaEvents as me", "me.id", "src.metaEventId")
      .leftJoin("ignoredMetaSourceEvents as i", (join) =>
        join.on("i.provider", "=", TOPDECK_PROVIDER).onRef("i.externalId", "=", "c.tid"),
      );
  }

  const fetchedAt = sql<Date | null>`(
    select max(st.fetched_at) from topdeck_event_standings st where st.tid = c.tid
  )`;

  // Correlated against the mirror: an index lookup per page row, not an aggregate over the whole archive.
  const stagedPlayerCount = sql<number>`(
    select count(*)::int from topdeck_event_standings st where st.tid = c.tid
  )`;

  const stagedLegendCount = sql<number>`(
    select count(*)::int from topdeck_event_standings st
     where st.tid = c.tid and st.legend_name is not null
  )`;

  const stagedDeckCount = sql<number>`(
    select count(*)::int from topdeck_decklists dl
     where dl.tid = c.tid and dl.fetch_status = 'fetched'
  )`;

  /**
   * Null until accepted, for an event only this source describes, or once the
   * cross-mirror review has let this citation contribute.
   */
  const rivalProvider = sql<string | null>`(
    case when src.contributes then null else (
      select min(o.provider) from meta_event_sources o
       where o.meta_event_id = src.meta_event_id
         and o.provider is not null
         and o.provider <> ${TOPDECK_PROVIDER}
    ) end
  )`;

  const bucketColumns: MetaSyncBucketColumns = {
    started: sql<SqlBool>`c.start_at <= now()`,
    startAt: sql<Date | null>`c.start_at`,
    hasResults: sql<SqlBool>`c.player_count > 0`,
    nextCheckAt: sql<Date | null>`null::timestamptz`,
    passes: (rule) =>
      sizeRulePasses(
        sql<number | null>`c.player_count`,
        sql<SqlBool>`c.is_team_event`,
        rule.autoAcceptMinPlayers,
      ),
  };

  const paged = pagedTriage(TOPDECK_PROVIDER, KEY);

  function listSelect() {
    return triagedQuery()
      .selectAll("c")
      .select([
        TRIAGE_STATE.as("triage"),
        "src.metaEventId as metaEventId",
        "me.slug as metaEventSlug",
        fetchedAt.as("fetchedAt"),
        stagedPlayerCount.as("stagedPlayerCount"),
        stagedLegendCount.as("stagedLegendCount"),
        stagedDeckCount.as("stagedDeckCount"),
        rivalProvider.as("rivalProvider"),
      ]);
  }

  function narrowing(filters: TopdeckListFilters): RawBuilder<SqlBool>[] {
    const conditions: RawBuilder<SqlBool>[] = [];
    if (filters.search !== undefined && filters.search.trim() !== "") {
      const like = containsPattern(filters.search.trim());
      conditions.push(sql<SqlBool>`(c.name ilike ${like} or c.city ilike ${like})`);
    }
    if (filters.format !== undefined) {
      conditions.push(sql<SqlBool>`c.format = ${filters.format}`);
    }
    if (filters.minPlayers !== undefined) {
      conditions.push(sql<SqlBool>`c.player_count >= ${filters.minPlayers}`);
    }
    // `start_at` is an instant, so a day bound is a half-open range on it.
    if (filters.dateFrom !== undefined) {
      conditions.push(sql<SqlBool>`c.start_at >= ${filters.dateFrom}::date`);
    }
    if (filters.dateTo !== undefined) {
      conditions.push(sql<SqlBool>`c.start_at < (${filters.dateTo}::date + interval '1 day')`);
    }
    if (filters.missing === true) {
      conditions.push(sql<SqlBool>`c.missing_since is not null`);
    }
    return conditions;
  }

  return {
    /** Hash-gated: an unchanged row costs one `last_seen_at` write. */
    async upsertBatch(
      rows: readonly TopdeckUpsertInput[],
      seenAt: Date,
    ): Promise<MirrorUpsertResult<string>> {
      return await upsertMirrorRows(
        rows.map((row) => ({ ...row, lastSeenAt: seenAt, missingSince: null })),
        {
          keyOf: (row) => row.tid,
          write: async (batch) => {
            const written = await db
              .insertInto("topdeckEvents")
              .values(batch)
              .onConflict((oc) =>
                oc
                  .columns(["tid"])
                  .doUpdateSet((eb) => ({
                    name: eb.ref("excluded.name"),
                    format: eb.ref("excluded.format"),
                    startAt: eb.ref("excluded.startAt"),
                    swissRounds: eb.ref("excluded.swissRounds"),
                    topCut: eb.ref("excluded.topCut"),
                    playerCount: eb.ref("excluded.playerCount"),
                    isTeamEvent: eb.ref("excluded.isTeamEvent"),
                    teamSize: eb.ref("excluded.teamSize"),
                    city: eb.ref("excluded.city"),
                    state: eb.ref("excluded.state"),
                    country: eb.ref("excluded.country"),
                    address: eb.ref("excluded.address"),
                    longitude: eb.ref("excluded.longitude"),
                    latitude: eb.ref("excluded.latitude"),
                    contentHash: eb.ref("excluded.contentHash"),
                    lastSeenAt: eb.ref("excluded.lastSeenAt"),
                    missingSince: eb.ref("excluded.missingSince"),
                  }))
                  .where(
                    sql<SqlBool>`topdeck_events.content_hash is distinct from excluded.content_hash
                    or topdeck_events.missing_since is not null`,
                  ),
              )
              .returning(["tid", sql<boolean>`(xmax = 0)`.as("inserted")])
              .execute();
            return written.map((row) => ({ key: row.tid, inserted: row.inserted }));
          },
          touch: async (keys) => {
            await db
              .updateTable("topdeckEvents")
              .set({ lastSeenAt: seenAt })
              .where("tid", "in", keys)
              .execute();
          },
        },
      );
    },

    /** A sentinel no real hash equals, so the next pass reads the row as changed and rewrites its results. */
    async requeueResults(tids: readonly string[]): Promise<void> {
      for (const batch of keyBatches(tids)) {
        await db
          .updateTable("topdeckEvents")
          .set({ contentHash: RESULTS_PENDING })
          .where("tid", "in", batch)
          .execute();
      }
    },

    async markMissing(params: {
      from: Date;
      to: Date;
      format: string;
      seenBefore: Date;
      at: Date;
    }): Promise<number> {
      const result = await db
        .updateTable("topdeckEvents")
        .set({ missingSince: params.at })
        .where("format", "=", params.format)
        .where(sql<SqlBool>`date_trunc('milliseconds', start_at) >= ${params.from}`)
        .where(sql<SqlBool>`date_trunc('milliseconds', start_at) <= ${params.to}`)
        .where(sql<SqlBool>`date_trunc('milliseconds', last_seen_at) < ${params.seenBefore}`)
        .where("missingSince", "is", null)
        .executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0n);
    },

    async byKey(tid: string): Promise<TopdeckListRow | undefined> {
      return await listSelect().where("c.tid", "=", tid).executeTakeFirst();
    },

    tierInputsForLiveEvents(): Promise<TopdeckTierInputRow[]> {
      return db
        .selectFrom("topdeckEvents as e")
        .innerJoin("metaEventSources as s", (join) =>
          join.on("s.provider", "=", TOPDECK_PROVIDER).onRef("s.externalId", "=", "e.tid"),
        )
        .select(["s.metaEventId", "e.tid", "e.playerCount"])
        .execute();
    },

    list(
      filters: TopdeckListFilters,
      pagination: { limit: number; offset: number },
      order: MirrorListOrder = {},
    ): Promise<{ rows: TopdeckListRow[]; total: number }> {
      let query = listSelect()
        .orderBy(catalogOrderBy(sql`c.player_count`, order))
        // Ties on the sort column are common (a locals night files every store
        // on the same day), so the key breaks them and keeps paging stable.
        .orderBy("c.tid", "desc");
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

    async newKeys(): Promise<string[]> {
      const rows = await triagedQuery()
        .select("c.tid")
        .where(JOINED_TRIAGE.undecided)
        .orderBy(sql`c.start_at desc nulls last`)
        .execute();
      return rows.map((row) => row.tid);
    },

    async unacceptedByKeys(tids: readonly string[]): Promise<TopdeckListRow[]> {
      const rows: TopdeckListRow[] = [];
      for (const batch of keyBatches(tids)) {
        rows.push(
          ...(await listSelect()
            .where("c.tid", "in", batch)
            .where(JOINED_TRIAGE.undecided)
            .execute()),
        );
      }
      return rows;
    },

    /** The card bridge: a `short_code` resolves where a name does not, since our catalogue spells a legend by its epithet alone. */
    cardsByShortCode(
      shortCodes: readonly string[],
    ): Promise<Map<string, { cardId: string; name: string; type: string }>> {
      return cardsByShortCode(db, "EN", shortCodes);
    },

    /** The three queue counters are always zero, not a stub: one search writes an event's results with the event. */
    async syncOverview(rule: MetaAutoPublishRule): Promise<MirrorSyncOverview> {
      const row = await triagedQuery()
        .select(
          mirrorOverviewSelections(bucketColumns, rule, {
            // The search returns completed tournaments, so an event whose payload
            // carried standings is one whose results are published.
            completed: sql<SqlBool>`c.player_count > 0`,
            decklistPublished: sql<SqlBool>`exists (
            select 1 from topdeck_decklists dl where dl.tid = c.tid
          )`,
            awaitingResults: NEVER,
            cancelled: NEVER,
          }),
        )
        .executeTakeFirstOrThrow();
      return toMirrorSyncOverview(row);
    },

    async passingNoResultsKeys(rule: MetaAutoPublishRule): Promise<string[]> {
      const rows = await triagedQuery()
        .select(sql<string>`c.tid`.as("key"))
        .where(metaSyncBucketCondition("passingNoResults", bucketColumns, rule, paged))
        .execute();
      return rows.map((row) => row.key);
    },

    bucketCounts(
      filters: TopdeckListFilters,
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
