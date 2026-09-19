import type { Kysely, RawBuilder, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { MetaEventRow, MetaEventWithCounts } from "./meta-events.js";
import type { MetaScopeFacet, MetaScopeFilters } from "./meta-shared.js";
import { scopeConditions } from "./meta-shared.js";

export interface MetaEventIndexFilters extends MetaScopeFilters {
  slug?: string;
  q?: string;
  holds?: "decks" | "standings" | "upcoming" | "resultless";
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

const TODAY = sql<string>`(now() at time zone 'UTC')::date`;

/** EXISTS per event: counting standings rows to answer "has any" reads the whole table. */
const HAS_STANDINGS = sql<SqlBool>`exists (
  select 1 from meta_event_players p where p.meta_event_id = me.id
)`;

const HAS_DECKS = sql<SqlBool>`exists (
  select 1 from meta_event_players p where p.meta_event_id = me.id and p.deck_id is not null
)`;

const HOLDS_CONDITIONS = {
  decks: HAS_DECKS,
  standings: HAS_STANDINGS,
  upcoming: sql<SqlBool>`me.event_date > ${TODAY}`,
  resultless: sql<SqlBool>`not ${HAS_STANDINGS} and me.event_date <= ${TODAY}`,
} as const;

const EVENT_ORDER_COLUMNS = {
  date: sql`me.event_date`,
  name: sql`me.name`,
  tier: sql`case me.tier when 'premier' then 0 when 'competitive' then 1 else 2 end`,
  country: sql`me.country`,
} as const;

const COUNT_ORDER_COLUMNS = {
  players: sql`coalesce(c.player_row_count, 0)`,
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
      const pattern = `%${needle}%`;
      applied.push(
        sql<SqlBool>`(me.name ilike ${pattern} or me.organizer ilike ${pattern} or me.location ilike ${pattern})`,
      );
    }
    if (filters.holds !== undefined && lifted !== "holds") {
      applied.push(HOLDS_CONDITIONS[filters.holds]);
    }
    if (filters.playersMin !== undefined) {
      applied.push(sql<SqlBool>`me.player_count >= ${filters.playersMin}`);
    }
    if (filters.playersMax !== undefined) {
      applied.push(sql<SqlBool>`me.player_count <= ${filters.playersMax}`);
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
      .select([
        "p.metaEventId",
        sql<number>`count(*)::int`.as("playerRowCount"),
        sql<number>`count(p.deck_id)::int`.as("deckCount"),
      ])
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

  async function countsForEvents(ids: readonly string[]): Promise<Map<string, [number, number]>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await db
      .selectFrom("metaEventPlayers as p")
      .select([
        "p.metaEventId",
        sql<number>`count(*)::int`.as("playerRowCount"),
        sql<number>`count(p.deck_id)::int`.as("deckCount"),
      ])
      .where(sql<SqlBool>`p.meta_event_id = any(${[...ids]}::uuid[])`)
      .groupBy("p.metaEventId")
      .execute();
    return new Map(rows.map((row) => [row.metaEventId, [row.playerRowCount, row.deckCount]]));
  }

  function withCounts(
    rows: readonly MetaEventRow[],
    counts: Map<string, [number, number]>,
  ): MetaEventWithCounts[] {
    return rows.map((row) => {
      const [playerRowCount, deckCount] = counts.get(row.id) ?? [0, 0];
      return { ...row, playerRowCount, deckCount };
    });
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
      const rows = await rowQuery
        .orderBy(sql`${column} ${direction}`)
        .orderBy(sql`${EVENT_ORDER_COLUMNS.tier} asc`)
        .orderBy("me.name", "asc")
        .orderBy("me.slug", "asc")
        .limit(page.limit)
        .offset(page.offset)
        .execute();
      const [counts, countRow] = await Promise.all([
        countsForEvents(rows.map((row) => row.id)),
        filtered(filters)
          .select((eb) => eb.fn.countAll<string>().as("total"))
          .executeTakeFirstOrThrow(),
      ]);
      return { rows: withCounts(rows, counts), total: Number(countRow.total) };
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
          sql<number>`count(*) filter (where me.event_date > ${TODAY})::int`.as("upcoming"),
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
      return withCounts(rows, await countsForEvents(rows.map((row) => row.id)));
    },
  };
}
