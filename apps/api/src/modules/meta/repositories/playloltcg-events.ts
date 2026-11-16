import type { MetaSyncBucketFilter } from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDay } from "@openrift/shared/format-date";
import type { Kysely, RawBuilder, Selectable, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type {
  PlayloltcgEventsTable,
  PlayloltcgShopsTable,
} from "../../../db/tables/meta-sources.js";
import { keyBatches, rowBatches } from "../../../lib/bind-batches.js";
import { containsPattern } from "../../../lib/like-pattern.js";
import { MIRROR_NAME_MAX } from "../../../lib/meta-name-limits.js";
import { PLAYLOLTCG_PROVIDER, PLAYLOLTCG_STATUS_FINISHED } from "../../../lib/meta-providers.js";
import { offsetPage } from "../../../repositories/query-helpers.js";
import { dueBefore, TODAY } from "./meta-shared.js";
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
  mirrorFieldConditions,
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
import { cardsByShortCode } from "./mirror-results.js";
import type { MirrorUpsertResult } from "./mirror-upsert.js";
import { upsertMirrorRows } from "./mirror-upsert.js";

type PlayloltcgEventRow = Selectable<PlayloltcgEventsTable>;

export type PlayloltcgUpsertInput = Omit<
  PlayloltcgEventRow,
  "shopId" | "firstSeenAt" | "lastSeenAt" | "missingSince"
>;

export type PlayloltcgShopInput = Omit<Selectable<PlayloltcgShopsTable>, "createdAt" | "updatedAt">;

export interface PlayloltcgTierInputRow {
  metaEventId: string;
  activityShopId: number;
  playerCount: number | null;
}

export interface PlayloltcgListRow extends PlayloltcgEventRow {
  triage: MirrorTriage;
  metaEventId: string | null;
  metaEventSlug: string | null;
  shopDisplayName: string | null;
  nextCheckAt: Date | null;
  checkStage: number;
  fetchedAt: Date | null;
  stagedPlayerCount: number;
  stagedLegendCount: number;
  stagedDeckCount: number;
  heldBy: MirrorHeldBy | null;
}

export interface PlayloltcgRecheckRow extends PlayloltcgListRow {
  important: boolean;
  failingSince: Date | null;
}

export interface PlayloltcgListFilters {
  search?: string;
  status?: number;
  triage?: MirrorTriage;
  minPlayers?: number;
  dateFrom?: string;
  dateTo?: string;
  missing?: boolean;
  bucket?: { name: MetaSyncBucketFilter; rule: MetaAutoPublishRule };
}

const KEY = sql<string>`c.activity_shop_id::text`;

export function playloltcgEventsRepo(db: Kysely<Database>) {
  /** Joined once and reused by the reads, so they can never disagree about what "accepted" means. */
  function triagedQuery() {
    return db
      .selectFrom("playloltcgEvents as c")
      .leftJoin("metaEventSources as src", (join) =>
        join
          .on("src.provider", "=", PLAYLOLTCG_PROVIDER)
          .on(sql<SqlBool>`src.external_id = c.activity_shop_id::text`),
      )
      .leftJoin("metaEvents as me", "me.id", "src.metaEventId")
      .leftJoin("ignoredMetaSourceEvents as i", (join) =>
        join
          .on("i.provider", "=", PLAYLOLTCG_PROVIDER)
          .on(sql<SqlBool>`i.external_id = c.activity_shop_id::text`),
      )
      .leftJoin("playloltcgShops as s", "s.id", "c.shopId")
      .leftJoin("playloltcgEventChecks as ck", "ck.activityShopId", "c.activityShopId");
  }

  const joinedColumns = [
    sql<string | null>`coalesce(s.name, c.shop_name)`.as("shopDisplayName"),
    sql<Date | null>`ck.next_check_at`.as("nextCheckAt"),
    sql<number>`coalesce(ck.check_stage, 0)`.as("checkStage"),
  ];

  const fetchedAt = sql<Date | null>`(
    select max(st.fetched_at) from playloltcg_event_standings st
     where st.activity_shop_id = c.activity_shop_id
  )`;

  const stagedPlayerCount = sql<number>`(
    select count(*)::int from playloltcg_event_standings st
     where st.activity_shop_id = c.activity_shop_id
  )`;

  const stagedLegendCount = sql<number>`(
    select count(*)::int from playloltcg_event_standings st
     where st.activity_shop_id = c.activity_shop_id and st.legend_name is not null
  )`;

  const stagedDeckCount = sql<number>`(
    select count(*)::int from playloltcg_decklists dl
     where dl.activity_shop_id = c.activity_shop_id and dl.fetch_status = 'fetched'
       and exists (select 1 from playloltcg_decklist_cards dc where dc.source_deck_id = dl.source_deck_id)
  )`;

  const bucketColumns: MetaSyncBucketColumns = {
    started: sql<SqlBool>`c.start_at <= ${TODAY}`,
    startAt: sql<Date | null>`c.start_at::timestamptz`,
    hasResults: sql<SqlBool>`coalesce(c.status = ${PLAYLOLTCG_STATUS_FINISHED}, false)`,
    nextCheckAt: sql<Date | null>`ck.next_check_at`,
    passes: (rule) =>
      sizeRulePasses(
        sql<number | null>`c.player_count`,
        sql<SqlBool>`false`,
        rule.autoAcceptMinPlayers,
      ),
    held: heldBySameStore(PLAYLOLTCG_PROVIDER, KEY),
  };

  const paged = pagedTriage(PLAYLOLTCG_PROVIDER, KEY);

  function listSelect(rule?: MetaAutoPublishRule) {
    return triagedQuery()
      .selectAll("c")
      .select([
        TRIAGE_STATE.as("triage"),
        "src.metaEventId as metaEventId",
        fetchedAt.as("fetchedAt"),
        "me.slug as metaEventSlug",
        stagedPlayerCount.as("stagedPlayerCount"),
        heldBySelection(PLAYLOLTCG_PROVIDER, KEY, bucketColumns, rule),
        stagedLegendCount.as("stagedLegendCount"),
        stagedDeckCount.as("stagedDeckCount"),
        ...joinedColumns,
      ]);
  }

  function narrowing(filters: PlayloltcgListFilters): RawBuilder<SqlBool>[] {
    const conditions: RawBuilder<SqlBool>[] = [];
    if (filters.search !== undefined && filters.search.trim() !== "") {
      const like = containsPattern(filters.search.trim());
      conditions.push(sql<SqlBool>`(c.name ilike ${like} or c.shop_name ilike ${like})`);
    }
    if (filters.status !== undefined) {
      conditions.push(sql<SqlBool>`c.status = ${filters.status}`);
    }
    return [...conditions, ...mirrorFieldConditions(filters)];
  }

  return {
    async upsertShops(shops: readonly PlayloltcgShopInput[]): Promise<number> {
      if (shops.length === 0) {
        return 0;
      }
      for (const batch of rowBatches(
        shops.map((shop) => ({ ...shop, name: shop.name.slice(0, MIRROR_NAME_MAX) })),
      )) {
        await db
          .insertInto("playloltcgShops")
          .values(batch)
          .onConflict((oc) =>
            oc.column("id").doUpdateSet((eb) => ({
              name: eb.ref("excluded.name"),
              province: eb.ref("excluded.province"),
              city: eb.ref("excluded.city"),
              area: eb.ref("excluded.area"),
              address: eb.ref("excluded.address"),
              longitude: eb.ref("excluded.longitude"),
              latitude: eb.ref("excluded.latitude"),
            })),
          )
          .execute();
      }
      return shops.length;
    },

    /**
     * `shop_id` is never written here: the listing does not carry it, so a
     * re-catalogued row keeps the link it already has.
     */
    async upsertBatch(
      rows: readonly PlayloltcgUpsertInput[],
      seenAt: Date,
    ): Promise<MirrorUpsertResult<number>> {
      return await upsertMirrorRows(
        rows.map((row) => ({ ...row, lastSeenAt: seenAt, missingSince: null })),
        {
          keyOf: (row) => row.activityShopId,
          write: async (batch) => {
            const written = await db
              .insertInto("playloltcgEvents")
              .values(batch)
              .onConflict((oc) =>
                oc
                  .columns(["activityShopId"])
                  .doUpdateSet((eb) => ({
                    shopName: eb.ref("excluded.shopName"),
                    name: eb.ref("excluded.name"),
                    activityType: eb.ref("excluded.activityType"),
                    activityTypeName: eb.ref("excluded.activityTypeName"),
                    battleMode: eb.ref("excluded.battleMode"),
                    status: eb.ref("excluded.status"),
                    startAt: eb.ref("excluded.startAt"),
                    endAt: eb.ref("excluded.endAt"),
                    playerCount: eb.ref("excluded.playerCount"),
                    maxUser: eb.ref("excluded.maxUser"),
                    fee: eb.ref("excluded.fee"),
                    province: eb.ref("excluded.province"),
                    city: eb.ref("excluded.city"),
                    area: eb.ref("excluded.area"),
                    address: eb.ref("excluded.address"),
                    longitude: eb.ref("excluded.longitude"),
                    latitude: eb.ref("excluded.latitude"),
                    contentHash: eb.ref("excluded.contentHash"),
                    lastSeenAt: eb.ref("excluded.lastSeenAt"),
                    missingSince: eb.ref("excluded.missingSince"),
                  }))
                  .where(
                    sql<SqlBool>`playloltcg_events.content_hash is distinct from excluded.content_hash
                    or playloltcg_events.missing_since is not null`,
                  ),
              )
              .returning(["activityShopId", sql<boolean>`(xmax = 0)`.as("inserted")])
              .execute();
            return written.map((row) => ({ key: row.activityShopId, inserted: row.inserted }));
          },
          touch: async (keys) => {
            await db
              .updateTable("playloltcgEvents")
              .set({ lastSeenAt: seenAt })
              .where("activityShopId", "in", keys)
              .execute();
          },
        },
      );
    },

    async markMissing(params: {
      from: string;
      to: string;
      seenBefore: Date;
      at: Date;
    }): Promise<number> {
      const result = await db
        .updateTable("playloltcgEvents")
        .set({ missingSince: params.at })
        .where("startAt", ">=", params.from)
        .where("startAt", "<=", params.to)
        .where(sql<SqlBool>`date_trunc('milliseconds', last_seen_at) < ${params.seenBefore}`)
        .where("missingSince", "is", null)
        .executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0n);
    },

    /** The shop row is upserted first so the FK always holds, even for a store the registry sweep has not caught yet. */
    async linkShopFromDetail(
      activityShopId: number,
      shop: { id: number; name: string },
    ): Promise<void> {
      await db
        .insertInto("playloltcgShops")
        .values({ id: shop.id, name: shop.name.slice(0, MIRROR_NAME_MAX) })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet((eb) => ({ name: eb.ref("excluded.name") })),
        )
        .execute();
      await db
        .updateTable("playloltcgEvents")
        .set({ shopId: shop.id })
        .where("activityShopId", "=", activityShopId)
        .execute();
    },

    async byKey(activityShopId: number): Promise<PlayloltcgListRow | undefined> {
      return await listSelect().where("c.activityShopId", "=", activityShopId).executeTakeFirst();
    },

    /** This source maps no template, so field size is the whole rule. */
    tierInputsForLiveEvents(): Promise<PlayloltcgTierInputRow[]> {
      return db
        .selectFrom("playloltcgEvents as e")
        .innerJoin("metaEventSources as s", (join) =>
          join
            .on("s.provider", "=", PLAYLOLTCG_PROVIDER)
            .on(sql<SqlBool>`s.external_id = e.activity_shop_id::text`),
        )
        .select(["s.metaEventId", "e.activityShopId", "e.playerCount"])
        .execute();
    },

    list(
      filters: PlayloltcgListFilters,
      pagination: { limit: number; offset: number },
      order: MirrorListOrder = {},
      rule?: MetaAutoPublishRule,
    ): Promise<{ rows: PlayloltcgListRow[]; total: number }> {
      let query = listSelect(rule)
        .orderBy(catalogOrderBy(sql`c.player_count`, order))
        // Ties on the sort column are common (a locals night files every store
        // on the same day), so the key breaks them and keeps paging stable.
        .orderBy("c.activityShopId", "desc");
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

    async dueForRecheck(now: Date, limit: number): Promise<PlayloltcgRecheckRow[]> {
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

    /** Re-arms started events, including ones that left the ladder. */
    async pullForwardRechecks(activityShopIds: readonly number[], now: Date): Promise<number> {
      const today = formatDay(now);
      let pulled = 0;
      for (const batch of keyBatches(activityShopIds)) {
        const result = await db
          .updateTable("playloltcgEventChecks as ck")
          .set({ nextCheckAt: now })
          .where("ck.activityShopId", "in", batch)
          .where((eb) =>
            eb.or([
              eb("ck.nextCheckAt", "is", null),
              eb(sql`date_trunc('milliseconds', ck.next_check_at)`, ">", now),
            ]),
          )
          .where((eb) =>
            eb.exists(
              eb
                .selectFrom("playloltcgEvents as e")
                .select("e.activityShopId")
                .whereRef("e.activityShopId", "=", "ck.activityShopId")
                .where("e.startAt", "<=", today),
            ),
          )
          .executeTakeFirst();
        pulled += Number(result.numUpdatedRows);
      }
      return pulled;
    },

    async setRecheck(
      activityShopId: number,
      values: { nextCheckAt: Date | null; checkStage: number; failingSince?: Date | null },
    ): Promise<void> {
      await db
        .insertInto("playloltcgEventChecks")
        .values({ activityShopId, ...values })
        .onConflict((oc) => oc.column("activityShopId").doUpdateSet(values))
        .execute();
    },

    async clearFailing(activityShopId: number): Promise<void> {
      await db
        .updateTable("playloltcgEventChecks")
        .set({ failingSince: null })
        .where("activityShopId", "=", activityShopId)
        .execute();
    },

    async newKeys(): Promise<number[]> {
      const rows = await triagedQuery()
        .select("c.activityShopId")
        .where(JOINED_TRIAGE.undecided)
        .orderBy(sql`c.start_at desc nulls last`)
        .execute();
      return rows.map((row) => row.activityShopId);
    },

    async unacceptedByKeys(activityShopIds: readonly number[]): Promise<PlayloltcgListRow[]> {
      const rows: PlayloltcgListRow[] = [];
      for (const batch of keyBatches(activityShopIds)) {
        rows.push(
          ...(await listSelect()
            .where("c.activityShopId", "in", batch)
            .where(JOINED_TRIAGE.undecided)
            .execute()),
        );
      }
      return rows;
    },

    /** Bridges the source's `short_code` to our card identity; deterministic, unlike matching Chinese names. */
    cardsByShortCode(
      shortCodes: readonly string[],
    ): Promise<Map<string, { cardId: string; name: string; type: string }>> {
      return cardsByShortCode(db, "SC", shortCodes);
    },

    async syncOverview(rule: MetaAutoPublishRule): Promise<MirrorSyncOverview> {
      // An aggregate FILTER cannot become an anti-join, so `notFetched` here
      // would probe the mirror once per catalogue row. Pre-aggregate instead.
      const row = await triagedQuery()
        .leftJoin(
          (eb) =>
            eb
              .selectFrom("playloltcgEventStandings")
              .select("activityShopId")
              .distinct()
              .as("fetched"),
          (join) => join.onRef("fetched.activityShopId", "=", "c.activityShopId"),
        )
        .select(
          mirrorOverviewSelections(bucketColumns, rule, {
            // The source has no decklist_status column, so a finished event
            // (status 5) is the closest "results could exist" signal.
            completed: sql<SqlBool>`c.status = ${PLAYLOLTCG_STATUS_FINISHED}`,
            decklistPublished: sql<SqlBool>`fetched.activity_shop_id is not null`,
            awaitingResults: sql<SqlBool>`fetched.activity_shop_id is null`,
            cancelled: NEVER,
          }),
        )
        .executeTakeFirstOrThrow();
      return toMirrorSyncOverview(row);
    },

    async passingNoResultsKeys(rule: MetaAutoPublishRule): Promise<string[]> {
      const rows = await triagedQuery()
        .select(sql<string>`c.activity_shop_id::text`.as("key"))
        .where(metaSyncBucketCondition("passingNoResults", bucketColumns, rule, paged))
        .execute();
      return rows.map((row) => row.key);
    },

    bucketCounts(
      filters: PlayloltcgListFilters,
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
