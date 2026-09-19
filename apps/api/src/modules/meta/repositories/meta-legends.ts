import type { CardType, MetaEventTier, MetaListStatus } from "@openrift/shared/types/enums";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { MetaScopeFilters } from "./meta-shared.js";
import { foldedPlayerIdentity, resolvedPlayerName, scopeConditions } from "./meta-shared.js";

/**
 * One legend the archive holds a result for, with the card fields a display
 * name and a route key are built from.
 */
export interface MetaArchiveLegendRow {
  cardId: string;
  name: string;
  slug: string;
  types: CardType[] | null;
  tags: string[] | null;
  domains: string[] | null;
}

/** One legend as the sitemap lists it: the route key's ingredients plus its lastmod. */
export interface MetaLegendSitemapRow extends MetaArchiveLegendRow {
  updatedAt: Date;
}

/** One archived standings row as a legend's own page lists it. */
export interface MetaLegendFinishRow {
  playerId: string;
  rank: number;
  rankIsTier: boolean;
  playerName: string;
  sourceIdentity: string | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  shareToken: string | null;
  listStatus: MetaListStatus;
  eventSlug: string;
  eventName: string;
  eventDate: string;
  eventFormat: string;
  eventTier: MetaEventTier;
  eventCountry: string | null;
  eventPlayerCount: number | null;
}

export interface MetaPlayerFinishRow {
  playerId: string;
  playerName: string;
  rank: number;
  rankIsTier: boolean;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  shareToken: string | null;
  listStatus: MetaListStatus;
  legendCardId: string | null;
  legendName: string | null;
  legendSlug: string | null;
  legendTypes: CardType[] | null;
  legendTags: string[] | null;
  legendDomains: string[] | null;
  eventSlug: string;
  eventName: string;
  eventDate: string;
  eventFormat: string;
  eventTier: MetaEventTier;
  eventCountry: string | null;
  eventPlayerCount: number | null;
}

export interface MetaLegendIndexRow extends MetaArchiveLegendRow {
  bestRank: number;
  bestRankIsTier: boolean;
  bestEventId: string;
  finishes: number;
  decklists: number;
  eventWins: number;
}

/** One legend's headline numbers inside a scope. */
export interface MetaLegendRecordCounts {
  /** Events won, not rank-1 rows: a shared first place at one event is one win. */
  wins: number;
  finishes: number;
  decklists: number;
}

export function metaLegendsRepo(db: Kysely<Database>) {
  /** One legend's standings rows inside a scope, before any ordering or select. */
  function legendFinishQuery(legendCardId: string, scope: MetaScopeFilters) {
    let query = db
      .selectFrom("metaEventPlayers as p")
      .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
      .leftJoin("decks as d", "d.id", "p.deckId")
      .leftJoin("uvsgamesPlayers as up", "up.id", "p.uvsgamesPlayerId")
      .where("p.legendCardId", "=", legendCardId);
    for (const condition of scopeConditions(scope)) {
      query = query.where(condition);
    }
    return query;
  }

  /** Those rows with the columns a legend's page prints. */
  function legendFinishRows(legendCardId: string, scope: MetaScopeFilters) {
    return legendFinishQuery(legendCardId, scope).select([
      "p.id as playerId",
      "p.rank",
      "p.rankIsTier",
      resolvedPlayerName.as("playerName"),
      "p.sourceIdentity",
      "p.wins",
      "p.losses",
      "p.draws",
      "d.shareToken",
      "p.listStatus",
      "me.slug as eventSlug",
      "me.name as eventName",
      "me.eventDate",
      "me.format as eventFormat",
      "me.tier as eventTier",
      "me.country as eventCountry",
      "me.playerCount as eventPlayerCount",
    ]);
  }

  return {
    /**
     * Every legend the archive holds a standings row for, with the count of
     * lists filed under it.
     *
     * Grouped by the card, not the champion: two legends of one champion are
     * two entries.
     */
    archiveLegends(): Promise<MetaArchiveLegendRow[]> {
      return db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("cards as lc", "lc.id", "p.legendCardId")
        .leftJoin("mvCardAggregates as mca", "mca.cardId", "lc.id")
        .select(["lc.id as cardId", "lc.name", "lc.slug", "mca.types", "lc.tags", "mca.domains"])
        .groupBy(["lc.id", "lc.name", "lc.slug", "mca.types", "lc.tags", "mca.domains"])
        .orderBy("lc.name", "asc")
        .execute();
    },

    /**
     * One row per legend in scope. A legend with no standings row is absent.
     * `eventWins` counts events and `decklists` permalinks, never rows.
     */
    scopedLegendRecords(scope: MetaScopeFilters = {}): Promise<MetaLegendIndexRow[]> {
      // Ends on `p.id`: the three aggregates below sort separately, so without
      // a unique tiebreak a tie can take each field from a different row.
      const best = sql`order by p.rank asc, me.event_date desc, p.id asc`;
      let query = db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
        .innerJoin("cards as lc", "lc.id", "p.legendCardId")
        .leftJoin("mvCardAggregates as mca", "mca.cardId", "lc.id")
        .leftJoin("decks as d", "d.id", "p.deckId")
        .select([
          "lc.id as cardId",
          "lc.name",
          "lc.slug",
          "mca.types",
          "lc.tags",
          "mca.domains",
          sql<number>`(array_agg(p.rank ${best}))[1]::int`.as("bestRank"),
          sql<boolean>`(array_agg(p.rank_is_tier ${best}))[1]`.as("bestRankIsTier"),
          sql<string>`(array_agg(me.id ${best}))[1]`.as("bestEventId"),
          sql<number>`count(*)::int`.as("finishes"),
          sql<number>`count(distinct d.share_token)::int`.as("decklists"),
          sql<number>`count(distinct me.id) filter (where p.rank = 1)::int`.as("eventWins"),
        ])
        .groupBy(["lc.id", "lc.name", "lc.slug", "mca.types", "lc.tags", "mca.domains"]);
      for (const condition of scopeConditions(scope)) {
        query = query.where(condition);
      }
      return query.execute();
    },

    /** How many legends `scopedLegendRecords` returns for the same scope. */
    async scopedLegendCount(scope: MetaScopeFilters = {}): Promise<number> {
      let query = db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
        .select(sql<number>`count(distinct p.legend_card_id)::int`.as("total"))
        .where("p.legendCardId", "is not", null);
      for (const condition of scopeConditions(scope)) {
        query = query.where(condition);
      }
      const row = await query.executeTakeFirstOrThrow();
      return row.total;
    },

    async scopedLegendCountries(scope: MetaScopeFilters = {}): Promise<string[]> {
      let query = db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
        .select("me.country")
        .distinct()
        .where("p.legendCardId", "is not", null)
        .where("me.country", "is not", null);
      for (const condition of scopeConditions(scope, "countries")) {
        query = query.where(condition);
      }
      const rows = await query.execute();
      return rows
        .map((row) => row.country)
        .filter((country): country is string => country !== null)
        .toSorted((left, right) => left.localeCompare(right));
    },

    /**
     * One page of a legend's record inside a scope, newest event first and the
     * better placing first inside one day.
     *
     * Every row is a published standings row. The archive computes nothing from
     * them here beyond their order.
     */
    async finishesForLegend(
      legendCardId: string,
      scope: MetaScopeFilters = {},
      page?: { limit: number; offset: number },
    ): Promise<{ rows: MetaLegendFinishRow[]; total: number }> {
      let rowQuery = legendFinishRows(legendCardId, scope)
        .orderBy("me.eventDate", "desc")
        .orderBy("p.rank", "asc")
        .orderBy("me.name", "asc")
        .orderBy("p.id", "asc");
      if (page !== undefined) {
        rowQuery = rowQuery.limit(page.limit).offset(page.offset);
      }
      const [rows, countRow] = await Promise.all([
        rowQuery.execute(),
        legendFinishQuery(legendCardId, scope)
          .select((eb) => eb.fn.countAll<string>().as("total"))
          .executeTakeFirstOrThrow(),
      ]);
      return { rows, total: Number(countRow.total) };
    },

    /**
     * A legend's high-water marks in scope: best placing first, the most recent
     * of an equal placing ahead of older ones.
     */
    bestFinishesForLegend(
      legendCardId: string,
      scope: MetaScopeFilters,
      limit: number,
    ): Promise<MetaLegendFinishRow[]> {
      return legendFinishRows(legendCardId, scope)
        .orderBy("p.rank", "asc")
        .orderBy("me.eventDate", "desc")
        .orderBy("me.name", "asc")
        .orderBy("p.id", "asc")
        .limit(limit)
        .execute();
    },

    /**
     * One legend's headline numbers in scope. Wins count events and decklists
     * count permalinks, never rows: a source that published a shared first place
     * files two rows at one event, and counting rows would report the legend
     * winning it twice.
     */
    legendRecordCounts(
      legendCardId: string,
      scope: MetaScopeFilters = {},
    ): Promise<MetaLegendRecordCounts> {
      return legendFinishQuery(legendCardId, scope)
        .select([
          sql<number>`count(distinct me.id) filter (where p.rank = 1)::int`.as("wins"),
          sql<number>`count(*)::int`.as("finishes"),
          sql<number>`count(distinct d.share_token)::int`.as("decklists"),
        ])
        .executeTakeFirstOrThrow();
    },

    finishesForPlayer(key: string): Promise<MetaPlayerFinishRow[]> {
      return db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
        .leftJoin("decks as d", "d.id", "p.deckId")
        .leftJoin("uvsgamesPlayers as up", "up.id", "p.uvsgamesPlayerId")
        .leftJoin("cards as lc", "lc.id", "p.legendCardId")
        .leftJoin("mvCardAggregates as lmca", "lmca.cardId", "p.legendCardId")
        .select([
          "p.id as playerId",
          resolvedPlayerName.as("playerName"),
          "p.rank",
          "p.rankIsTier",
          "p.wins",
          "p.losses",
          "p.draws",
          "d.shareToken",
          "p.listStatus",
          "p.legendCardId",
          "lc.name as legendName",
          "lc.slug as legendSlug",
          "lmca.types as legendTypes",
          "lc.tags as legendTags",
          "lmca.domains as legendDomains",
          "me.slug as eventSlug",
          "me.name as eventName",
          "me.eventDate",
          "me.format as eventFormat",
          "me.tier as eventTier",
          "me.country as eventCountry",
          "me.playerCount as eventPlayerCount",
        ])
        .where(foldedPlayerIdentity, "=", key)
        .orderBy("me.eventDate", "desc")
        .orderBy("p.rank", "asc")
        .execute();
    },
  };
}
