import type { META_EVENT_HOLDINGS, MetaScopeFacet } from "@openrift/shared/meta-query";
import type { Kysely, RawBuilder, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { containsPattern } from "../../../lib/like-pattern.js";
import { offsetPage } from "../../../repositories/query-helpers.js";
import type { MetaEventRow } from "./meta-events.js";
import type { MetaScopeFilters } from "./meta-shared.js";
import {
  HAS_DECKS,
  HAS_STANDINGS,
  PLAYED,
  RUNNING,
  scopeConditions,
  UPCOMING,
} from "./meta-shared.js";

export interface MetaEventIndexFilters extends MetaScopeFilters {
  slug?: string;
  q?: string;
  holds?: (typeof META_EVENT_HOLDINGS)[number];
  playersMin?: number;
  playersMax?: number;
}

export interface MetaEventIndexOrder {
  by?: "date" | "name" | "tier" | "country" | "players" | "decks";
  dir?: "asc" | "desc";
}

export interface MetaEventFacetCount {
  value: string;
  count: number;
}

export interface MetaEventFacetCounts {
  formats: MetaEventFacetCount[];
  tiers: MetaEventFacetCount[];
  countries: MetaEventFacetCount[];
}

export interface MetaEventHoldingsCounts {
  all: number;
  decks: number;
  standings: number;
  upcoming: number;
  resultless: number;
}

export interface MetaEventTotals {
  events: number;
  playerRows: number;
  decks: number;
}

const HOLDS_CONDITIONS = {
  decks: HAS_DECKS,
  standings: HAS_STANDINGS,
  upcoming: UPCOMING,
  comingUp: sql<SqlBool>`(${UPCOMING} or ${RUNNING})`,
  resultless: sql<SqlBool>`not ${HAS_STANDINGS} and not ${UPCOMING} and ${PLAYED}`,
} as const;

/** The reported field size, else the standings rows held; neither means no size. */
function fieldSizeAtLeast(min: number): RawBuilder<SqlBool> {
  return sql<SqlBool>`(me.player_count >= ${min}
    or (me.player_count is null and me.player_row_count >= ${Math.max(min, 1)}))`;
}

function fieldSizeAtMost(max: number): RawBuilder<SqlBool> {
  return sql<SqlBool>`(me.player_count <= ${max}
    or (me.player_count is null and me.player_row_count between 1 and ${max}))`;
}

const EVENT_ORDER_COLUMNS = {
  date: sql`me.event_date`,
  name: sql`me.name`,
  tier: sql`case me.tier when 'premier' then 0 when 'competitive' then 1 else 2 end`,
  country: sql`me.country`,
} as const;

const COUNT_ORDER_COLUMNS = {
  players: sql`coalesce(me.player_count, nullif(me.player_row_count, 0))`,
  decks: sql`me.deck_count`,
} as const;

export function metaEventIndexRepo(db: Kysely<Database>) {
  function conditions(
    filters: MetaEventIndexFilters,
    lifted?: MetaScopeFacet | "holds",
  ): RawBuilder<SqlBool>[] {
    const applied = [...scopeConditions(filters, lifted === "holds" ? undefined : lifted)];
    if (filters.slug !== undefined) {
      applied.push(sql<SqlBool>`me.slug = ${filters.slug}`);
    }
    const needle = filters.q?.trim() ?? "";
    if (needle !== "") {
      const pattern = containsPattern(needle);
      applied.push(
        sql<SqlBool>`(me.name ilike ${pattern} or me.organizer ilike ${pattern} or me.location ilike ${pattern})`,
      );
    }
    if (filters.holds !== undefined && lifted !== "holds") {
      applied.push(HOLDS_CONDITIONS[filters.holds]);
    }
    if (filters.playersMin !== undefined) {
      applied.push(fieldSizeAtLeast(filters.playersMin));
    }
    if (filters.playersMax !== undefined) {
      applied.push(fieldSizeAtMost(filters.playersMax));
    }
    return applied;
  }

  function filtered(filters: MetaEventIndexFilters, lifted?: MetaScopeFacet | "holds") {
    let query = db.selectFrom("metaEvents as me");
    for (const condition of conditions(filters, lifted)) {
      query = query.where(condition);
    }
    return query;
  }

  async function facetCounts(
    filters: MetaEventIndexFilters,
    facet: MetaScopeFacet,
    column: "format" | "tier" | "country",
  ): Promise<MetaEventFacetCount[]> {
    const rows = await filtered(filters, facet)
      .select((eb) => [
        sql<string | null>`me.${sql.raw(column)}`.as("value"),
        eb.cast<number>(eb.fn.countAll(), "integer").as("count"),
      ])
      .groupBy(sql`me.${sql.raw(column)}`)
      .execute();
    return rows
      .filter((row): row is { value: string; count: number } => row.value !== null)
      .toSorted((left, right) => left.value.localeCompare(right.value));
  }

  return {
    /** One page of the public event index, with the full count the filter matches. */
    async eventIndex(
      filters: MetaEventIndexFilters,
      order: MetaEventIndexOrder,
      page: { limit: number; offset: number },
    ): Promise<{ rows: MetaEventRow[]; total: number }> {
      const by = order.by ?? "date";
      const direction = order.dir === "asc" ? sql`asc` : sql`desc`;
      const byCount = by === "players" || by === "decks";
      const column = byCount ? COUNT_ORDER_COLUMNS[by] : EVENT_ORDER_COLUMNS[by];
      let rowQuery = filtered(filters).selectAll("me");
      if (by === "country") {
        rowQuery = rowQuery.orderBy(sql`me.country is null asc`);
      }
      const { rows, total } = await offsetPage(
        rowQuery
          .orderBy(
            // Only the field size can be null; any other column keeps the bare
            // order so the event_date index still serves the default page.
            by === "players" ? sql`${column} ${direction} nulls last` : sql`${column} ${direction}`,
          )
          .orderBy(sql`${EVENT_ORDER_COLUMNS.tier} asc`)
          .orderBy("me.name", "asc")
          .orderBy("me.slug", "asc"),
        page,
      );
      return { rows, total };
    },

    async eventFacetCounts(filters: MetaEventIndexFilters): Promise<MetaEventFacetCounts> {
      const [formats, tiers, countries] = await Promise.all([
        facetCounts(filters, "formats", "format"),
        facetCounts(filters, "tiers", "tier"),
        facetCounts(filters, "countries", "country"),
      ]);
      return { formats, tiers, countries };
    },

    eventHoldingsCounts(filters: MetaEventIndexFilters): Promise<MetaEventHoldingsCounts> {
      return filtered(filters, "holds")
        .select([
          sql<number>`count(*)::int`.as("all"),
          sql<number>`count(*) filter (where ${HAS_DECKS})::int`.as("decks"),
          sql<number>`count(*) filter (where ${HAS_STANDINGS})::int`.as("standings"),
          sql<number>`count(*) filter (where ${HOLDS_CONDITIONS.upcoming})::int`.as("upcoming"),
          sql<number>`count(*) filter (where ${HOLDS_CONDITIONS.resultless})::int`.as("resultless"),
        ])
        .executeTakeFirstOrThrow();
    },

    eventTotals(filters: MetaEventIndexFilters): Promise<MetaEventTotals> {
      return filtered(filters)
        .select([
          sql<number>`count(*)::int`.as("events"),
          sql<number>`coalesce(sum(me.player_row_count), 0)::int`.as("playerRows"),
          sql<number>`coalesce(sum(me.deck_count), 0)::int`.as("decks"),
        ])
        .executeTakeFirstOrThrow();
    },

    /** Events per event day under the filters, days with none omitted. */
    async eventDayCounts(
      filters: Omit<MetaEventIndexFilters, "from" | "to">,
    ): Promise<Record<string, number>> {
      const rows = await filtered(filters)
        .select((eb) => ["me.eventDate", eb.cast<number>(eb.fn.countAll(), "integer").as("count")])
        .groupBy("me.eventDate")
        .execute();
      return Object.fromEntries(rows.map((row) => [row.eventDate, row.count]));
    },

    async eventsBySlugs(slugs: readonly string[]): Promise<MetaEventRow[]> {
      if (slugs.length === 0) {
        return [];
      }
      return db
        .selectFrom("metaEvents as me")
        .selectAll("me")
        .where(sql<SqlBool>`me.slug = any(${[...slugs]}::text[])`)
        .orderBy("me.slug", "asc")
        .execute();
    },
  };
}
