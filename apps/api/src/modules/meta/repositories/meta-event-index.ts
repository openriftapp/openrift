import type { META_EVENT_HOLDINGS, MetaScopeFacet } from "@openrift/shared/meta-query";
import type { Kysely, RawBuilder, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { containsPattern } from "../../../lib/like-pattern.js";
import { offsetPage } from "../../../repositories/query-helpers.js";
import type { MetaEventWithCounts } from "./meta-events.js";
import { EVENT_COUNT_COLUMNS, withEventCounts } from "./meta-events.js";
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

function unreportedHolding(held: RawBuilder<SqlBool>): RawBuilder<SqlBool> {
  return sql<SqlBool>`me.id in (
    select p.meta_event_id from meta_event_players p
      join meta_events m2 on m2.id = p.meta_event_id
     where m2.player_count is null
     group by p.meta_event_id
    having ${held}
  )`;
}

/**
 * The reported field size, else the standings rows held; neither means no size.
 * An OR on the bare column with an uncorrelated fallback: a coalesce or a
 * correlated count makes the planner aggregate every standings row.
 */
function fieldSizeAtLeast(min: number): RawBuilder<SqlBool> {
  return sql<SqlBool>`(me.player_count >= ${min} or ${unreportedHolding(
    sql<SqlBool>`count(*) >= ${Math.max(min, 1)}`,
  )})`;
}

function fieldSizeAtMost(max: number): RawBuilder<SqlBool> {
  return sql<SqlBool>`(me.player_count <= ${max} or ${unreportedHolding(
    sql<SqlBool>`count(*) between 1 and ${max}`,
  )})`;
}

const EVENT_ORDER_COLUMNS = {
  date: sql`me.event_date`,
  name: sql`me.name`,
  tier: sql`case me.tier when 'premier' then 0 when 'competitive' then 1 else 2 end`,
  country: sql`me.country`,
} as const;

const COUNT_ORDER_COLUMNS = {
  players: sql`coalesce(me.player_count, nullif(c.player_row_count, 0))`,
  decks: sql`coalesce(c.deck_count, 0)`,
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

  function filteredWithCounts(filters: MetaEventIndexFilters, lifted?: MetaScopeFacet | "holds") {
    const counted = db
      .selectFrom("metaEventPlayers as p")
      .select(["p.metaEventId", ...EVENT_COUNT_COLUMNS])
      .groupBy("p.metaEventId");
    // The scope is repeated inside the aggregate: a grouped count joined
    // afterwards cannot be narrowed, so it reads every standings row.
    const narrowed =
      conditions(filters, lifted).length === 0
        ? counted
        : counted.where("p.metaEventId", "in", filtered(filters, lifted).select("me.id"));
    return filtered(filters, lifted).leftJoin(narrowed.as("c"), (join) =>
      join.onRef("c.metaEventId", "=", "me.id"),
    );
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
    ): Promise<{ rows: MetaEventWithCounts[]; total: number }> {
      const by = order.by ?? "date";
      const direction = order.dir === "asc" ? sql`asc` : sql`desc`;
      const byCount = by === "players" || by === "decks";
      const column = byCount ? COUNT_ORDER_COLUMNS[by] : EVENT_ORDER_COLUMNS[by];
      let rowQuery = (byCount ? filteredWithCounts(filters) : filtered(filters)).selectAll("me");
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
      return { rows: await withEventCounts(db, rows), total };
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
        .leftJoin("metaEventPlayers as p", "p.metaEventId", "me.id")
        .select([
          sql<number>`count(distinct me.id)::int`.as("events"),
          sql<number>`count(p.id)::int`.as("playerRows"),
          sql<number>`count(p.deck_id)::int`.as("decks"),
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

    async eventsBySlugs(slugs: readonly string[]): Promise<MetaEventWithCounts[]> {
      if (slugs.length === 0) {
        return [];
      }
      const rows = await db
        .selectFrom("metaEvents as me")
        .selectAll("me")
        .where(sql<SqlBool>`me.slug = any(${[...slugs]}::text[])`)
        .orderBy("me.slug", "asc")
        .execute();
      return withEventCounts(db, rows);
    },
  };
}
