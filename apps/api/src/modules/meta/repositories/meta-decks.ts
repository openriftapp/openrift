import { MAX_FACET_VALUES } from "@openrift/shared/contracts/meta";
import type { DeckFormatConfig } from "@openrift/shared/types/api/deck";
import type {
  CardType,
  DeckZone,
  MetaEventTier,
  MetaListStatus,
} from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import type { Kysely, SelectQueryBuilder, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { ttlCached } from "../../../lib/ttl-cached.js";
import type { MetaScopeFacet, MetaScopeFilters } from "./meta-shared.js";
import {
  META_ARCHIVE_USER_ID,
  foldedPlayerIdentity,
  resolvedPlayerName,
  scopeConditions,
} from "./meta-shared.js";

/** One archived deck as the cross-event browser lists it. */
export interface MetaDeckSummaryRow {
  playerId: string;
  deckId: string;
  shareToken: string;
  listStatus: MetaListStatus;
  deckName: string;
  deckFormat: string;
  legendCardId: string | null;
  legendName: string | null;
  legendSlug: string | null;
  legendTypes: CardType[] | null;
  legendTags: string[] | null;
  championCardId: string | null;
  championName: string | null;
  playerName: string;
  sourceIdentity: string | null;
  rank: number;
  rankIsTier: boolean;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  eventSlug: string;
  eventName: string;
  eventDate: string;
  eventFormat: string;
  eventTier: MetaEventTier;
  eventCountry: string | null;
}

export interface MetaDeckCardRow {
  deckId: string;
  cardId: string;
  quantity: number;
  sideboard: boolean;
}

/**
 * The standings context an archived deck's page prints. Also the
 * archive-membership test the public deck endpoint uses: `undefined` means
 * the token's deck exists but is outside the archive, and must 404.
 */
export interface MetaDeckContextRow {
  playerId: string;
  listStatus: MetaListStatus;
  playerName: string;
  sourceIdentity: string | null;
  rank: number;
  rankIsTier: boolean;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  eventSlug: string;
  eventName: string;
  eventDate: string;
  eventFormat: string;
  eventTier: MetaEventTier;
  eventCountry: string | null;
  eventPlayerCount: number | null;
}

/** Which archived decks the browser is asking for, and how many rows of them. */
export interface MetaDeckFilters extends MetaScopeFilters {
  /** A legend's card id. */
  legend?: string;
  /** A player key, as {@link foldedPlayerIdentity} yields it. */
  player?: string;
  events?: readonly string[];
  legends?: readonly string[];
  maxRank?: number;
  curated?: boolean;
  by?: "date" | "finish";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface MetaDeckCardFilters extends MetaDeckFilters {
  eventSlug?: string;
}

export type MetaDeckFacet = "events" | "legends" | "finish" | MetaScopeFacet;

const SCOPE_FACETS = new Set<string>(["formats", "tiers", "countries"]);

export interface MetaDeckEventFacetRow {
  slug: string;
  name: string;
  eventDate: string;
  count: number;
}

export interface MetaDeckLegendFacetRow {
  cardId: string;
  name: string | null;
  types: CardType[] | null;
  tags: string[] | null;
  count: number;
}

export interface MetaDeckFacetRows {
  events: MetaDeckEventFacetRow[];
  legends: MetaDeckLegendFacetRow[];
  finishes: { value: number; count: number }[];
  countries: string[];
}

const DECK_PAGE_SIZE = 50;

const ARCHIVE_TOTAL_TTL_MS = 10 * 60 * 1000;

const FINISH_BOUNDS = [1, 4, 8, 16] as const;

const DECK_ORDER = {
  date: sql`me.event_date`,
  finish: sql`p.rank`,
} as const;

function deckOrderDirection(filters: MetaDeckFilters) {
  const fallback = (filters.by ?? "date") === "date" ? "desc" : "asc";
  return (filters.dir ?? fallback) === "asc" ? sql`asc` : sql`desc`;
}

function applyDeckFilters<DB, TB extends keyof DB, O>(
  query: SelectQueryBuilder<DB, TB, O>,
  filters: MetaDeckFilters,
  lifted?: MetaDeckFacet,
): SelectQueryBuilder<DB, TB, O> {
  const scopeLift =
    lifted !== undefined && SCOPE_FACETS.has(lifted) ? (lifted as MetaScopeFacet) : undefined;
  let narrowing = query;
  for (const condition of scopeConditions(filters, scopeLift)) {
    narrowing = narrowing.where(condition);
  }
  if (filters.legend !== undefined) {
    narrowing = narrowing.where(sql<SqlBool>`p.legend_card_id = ${filters.legend}::uuid`);
  }
  if (filters.player !== undefined) {
    narrowing = narrowing.where(sql<SqlBool>`${foldedPlayerIdentity} = ${filters.player}`);
  }
  if (lifted !== "events" && filters.events !== undefined && filters.events.length > 0) {
    narrowing = narrowing.where(sql<SqlBool>`me.slug = any(${[...filters.events]}::text[])`);
  }
  if (lifted !== "legends" && filters.legends !== undefined && filters.legends.length > 0) {
    narrowing = narrowing.where(
      sql<SqlBool>`p.legend_card_id = any(${[...filters.legends]}::uuid[])`,
    );
  }
  if (lifted !== "finish" && filters.maxRank !== undefined) {
    narrowing = narrowing.where(sql<SqlBool>`p.rank <= ${filters.maxRank}`);
  }
  return narrowing;
}

export interface MetaDeckCardInput {
  cardId: string;
  zone: DeckZone;
  quantity: number;
  preferredPrintingId: string | null;
}

/**
 * Folds repeated lines into one row per `uq_deck_cards` key, summing quantity.
 * The index is `NULLS NOT DISTINCT`, so the archive's null `preferred_printing_id`
 * does not separate two lines the way a null usually would, and a source that
 * lists a card across several lines (or under two names that resolve to one
 * card) would otherwise violate it.
 */
export function deckCardMergeKey(card: MetaDeckCardInput): string {
  return `${card.cardId} ${card.zone} ${card.preferredPrintingId ?? ""}`;
}

export function mergeDeckCards(cards: readonly MetaDeckCardInput[]): MetaDeckCardInput[] {
  const merged = new Map<string, MetaDeckCardInput>();
  for (const card of cards) {
    const key = deckCardMergeKey(card);
    const held = merged.get(key);
    if (held === undefined) {
      merged.set(key, { ...card });
      continue;
    }
    held.quantity += card.quantity;
  }
  return [...merged.values()];
}

export interface MetaStoredDeckCard {
  cardId: string;
  zone: string;
  quantity: number;
  preferredPrintingId: string | null;
}

function deckCardKey(card: MetaStoredDeckCard | MetaDeckCardInput): string {
  return `${card.cardId} ${card.zone} ${card.quantity} ${card.preferredPrintingId ?? ""}`;
}

/**
 * `incoming` is compared as given — callers pass it through
 * {@link mergeDeckCards} first, since that is the shape the table holds.
 */
export function sameDeckCards(
  existing: readonly MetaStoredDeckCard[],
  incoming: readonly MetaDeckCardInput[],
): boolean {
  if (existing.length !== incoming.length) {
    return false;
  }
  const held = new Map<string, number>();
  for (const card of existing) {
    const key = deckCardKey(card);
    held.set(key, (held.get(key) ?? 0) + 1);
  }
  for (const card of incoming) {
    const key = deckCardKey(card);
    const left = held.get(key) ?? 0;
    if (left === 0) {
      return false;
    }
    held.set(key, left - 1);
  }
  return true;
}

/**
 * The decklist attached to a standings row. `listStatus` cannot be `"none"`
 * here: that value means there is no deck, and the table CHECKs the two agree.
 */
export interface MetaArchivedDeckInput {
  name: string;
  format: string;
  formatConfig: DeckFormatConfig | null;
  cards: MetaDeckCardInput[];
  listStatus: Exclude<MetaListStatus, "none">;
}

export interface MetaStoredPlayerDeck {
  deckId: string;
  listStatus: MetaListStatus;
  name: string;
  format: string;
  cards: MetaStoredDeckCard[];
}

/** Writes the `decks` row and its cards, and points the standings row at it. */
export async function insertDeckForPlayer(
  trx: Kysely<Database>,
  playerId: string,
  deck: MetaArchivedDeckInput,
  shareToken: string | null,
): Promise<string> {
  const row = await trx
    .insertInto("decks")
    .values({
      userId: META_ARCHIVE_USER_ID,
      name: deck.name,
      description: null,
      format: deck.format,
      formatConfig: deck.formatConfig,
      // The permalink is the point of an archived deck; it is public from the
      // moment it exists, never through a later share toggle.
      isPublic: true,
      shareToken,
      links: [],
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  await trx
    .insertInto("deckCards")
    .values(mergeDeckCards(deck.cards).map((card) => ({ deckId: row.id, ...card })))
    .execute();

  await trx
    .updateTable("metaEventPlayers")
    .set({ deckId: row.id, listStatus: deck.listStatus })
    .where("id", "=", playerId)
    .execute();

  return row.id;
}

export function metaDecksRepo(db: Kysely<Database>) {
  function deckQuery() {
    return (
      db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("decks as d", "d.id", "p.deckId")
        .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
        .leftJoin("cards as lc", "lc.id", "p.legendCardId")
        .leftJoin("cards as cc", "cc.id", "p.championCardId")
        .leftJoin("mvCardAggregates as lmca", "lmca.cardId", "p.legendCardId")
        .leftJoin("uvsgamesPlayers as up", "up.id", "p.uvsgamesPlayerId")
        // Narrows the type, not the rows: a deck is minted with its permalink.
        .where("d.shareToken", "is not", null)
    );
  }

  const cachedArchiveTotal = ttlCached(ARCHIVE_TOTAL_TTL_MS, async () => {
    const row = await deckQuery()
      .select((eb) => eb.fn.countAll<string>().as("total"))
      .executeTakeFirstOrThrow();
    return Number(row.total);
  });

  function curatedIds(filters: MetaDeckFilters, lifted?: MetaDeckFacet) {
    const legendKey = sql`coalesce(p.legend_card_id::text, 'deck:' || p.deck_id)`;
    return applyDeckFilters(deckQuery(), filters, lifted)
      .distinctOn([sql`p.meta_event_id`, legendKey])
      .select("p.id")
      .orderBy(sql`p.meta_event_id`)
      .orderBy(legendKey)
      .orderBy("p.rank", "asc")
      .orderBy(resolvedPlayerName, "asc")
      .orderBy("p.id", "asc");
  }

  function orderedDeckPage<DB, TB extends keyof DB, O>(
    query: SelectQueryBuilder<DB, TB, O>,
    filters: MetaDeckFilters,
  ): SelectQueryBuilder<DB, TB, O> {
    return (
      query
        .orderBy(sql`${DECK_ORDER[filters.by ?? "date"]} ${deckOrderDirection(filters)}`)
        // A total order, so a page boundary neither repeats nor skips a row.
        .orderBy(sql`me.event_date desc`)
        .orderBy(sql`me.slug asc`)
        .orderBy(sql`p.rank asc`)
        .orderBy(sql`${resolvedPlayerName} asc`)
        .orderBy(sql`p.id asc`)
        .limit(filters.limit ?? DECK_PAGE_SIZE)
        .offset(filters.offset ?? 0)
    );
  }

  function narrowedDecks(filters: MetaDeckFilters, lifted?: MetaDeckFacet) {
    const query = applyDeckFilters(deckQuery(), filters, lifted);
    const curated =
      filters.curated === true
        ? query.where(sql<boolean>`p.id in (${curatedIds(filters, lifted)})`)
        : query;
    return curated;
  }

  function eventFacetRows(filters: MetaDeckFilters): Promise<MetaDeckEventFacetRow[]> {
    const counted = narrowedDecks(filters, "events")
      .select(["me.slug", "me.name", "me.eventDate", sql<number>`count(*)::int`.as("count")])
      .groupBy(["me.slug", "me.name", "me.eventDate"]);
    const picked = filters.events ?? [];
    if (picked.length === 0) {
      return counted
        .orderBy("me.eventDate", "desc")
        .orderBy("me.slug", "asc")
        .limit(MAX_FACET_VALUES)
        .execute();
    }
    const pickedSlugs = sql`${[...picked]}::text[]`;
    const lifted = db
      .selectFrom("metaEvents as me")
      .select(["me.slug", "me.name", "me.eventDate", sql<number>`0`.as("count")])
      .where(sql<SqlBool>`me.slug = any(${pickedSlugs})`);
    return (
      db
        .selectFrom(counted.unionAll(lifted).as("f"))
        .select(["f.slug", "f.name", "f.eventDate", sql<number>`sum(f."count")::int`.as("count")])
        .groupBy(["f.slug", "f.name", "f.eventDate"])
        // Picked events first, so the cap never drops a chip the filter is using.
        .orderBy(sql`f.slug = any(${pickedSlugs}) desc`)
        .orderBy("f.eventDate", "desc")
        .orderBy("f.slug", "asc")
        .limit(MAX_FACET_VALUES)
        .execute()
    );
  }

  function legendFacetRows(filters: MetaDeckFilters): Promise<MetaDeckLegendFacetRow[]> {
    const counted = narrowedDecks(filters, "legends")
      .where("p.legendCardId", "is not", null)
      .select([
        sql<string>`p.legend_card_id`.as("cardId"),
        "lc.name",
        "lmca.types",
        "lc.tags",
        sql<number>`count(*)::int`.as("count"),
      ])
      .groupBy(["p.legendCardId", "lc.name", "lmca.types", "lc.tags"]);
    const picked = filters.legends ?? [];
    if (picked.length === 0) {
      return counted.execute();
    }
    const lifted = db
      .selectFrom("cards as lc")
      .leftJoin("mvCardAggregates as lmca", "lmca.cardId", "lc.id")
      .select([
        sql<string>`lc.id`.as("cardId"),
        "lc.name",
        "lmca.types",
        "lc.tags",
        sql<number>`0`.as("count"),
      ])
      .where(sql<SqlBool>`lc.id = any(${[...picked]}::uuid[])`);
    return db
      .selectFrom(counted.unionAll(lifted).as("f"))
      .select([
        "f.cardId",
        "f.name",
        "f.types",
        "f.tags",
        sql<number>`sum(f."count")::int`.as("count"),
      ])
      .groupBy(["f.cardId", "f.name", "f.types", "f.tags"])
      .execute();
  }

  return {
    /**
     * The archived decks a browser is asking for, newest event first. Only rows
     * with a list appear: a standings-only entry has no deck to browse.
     *
     * The scope's facets narrow the rows before the cap does, so a capped
     * request fills its grid with rows that are already in scope.
     *
     * `total` counts the whole match, so a capped request can still say how much
     * of what it found it is showing, `eventCount` the events that match spans.
     * `archiveTotal` counts the same population with no filter at all, and can
     * be up to ten minutes old.
     */
    async allDeckSummaries(filters: MetaDeckFilters = {}): Promise<{
      rows: MetaDeckSummaryRow[];
      total: number;
      eventCount: number;
      archiveTotal: number;
    }> {
      const rowQuery = narrowedDecks(filters)
        .select([
          "p.id as playerId",
          "p.deckId",
          "d.shareToken",
          "p.listStatus",
          "d.name as deckName",
          "d.format as deckFormat",
          "p.legendCardId",
          "lc.name as legendName",
          "lc.slug as legendSlug",
          "lmca.types as legendTypes",
          "lc.tags as legendTags",
          "p.championCardId",
          "cc.name as championName",
          resolvedPlayerName.as("playerName"),
          "p.sourceIdentity",
          "p.rank",
          "p.rankIsTier",
          "p.wins",
          "p.losses",
          "p.draws",
          "me.slug as eventSlug",
          "me.name as eventName",
          "me.eventDate",
          "me.format as eventFormat",
          "me.tier as eventTier",
          "me.country as eventCountry",
        ])
        .$narrowType<{ deckId: string; shareToken: string }>();

      const [rows, archiveTotal] = await Promise.all([
        orderedDeckPage(rowQuery, filters).execute(),
        cachedArchiveTotal(),
      ]);
      if ((filters.offset ?? 0) === 0 && rows.length < (filters.limit ?? DECK_PAGE_SIZE)) {
        return {
          rows,
          total: rows.length,
          eventCount: new Set(rows.map((row) => row.eventSlug)).size,
          archiveTotal,
        };
      }
      const countRow = await narrowedDecks(filters)
        .select((eb) => [
          eb.fn.countAll<string>().as("total"),
          sql<number>`count(distinct p.meta_event_id)::int`.as("eventCount"),
        ])
        .executeTakeFirstOrThrow();
      return {
        rows,
        total: Number(countRow.total),
        eventCount: countRow.eventCount,
        archiveTotal,
      };
    },

    async deckFacetCounts(filters: MetaDeckFilters = {}): Promise<MetaDeckFacetRows> {
      const [events, legends, finishes, countries] = await Promise.all([
        eventFacetRows(filters),
        legendFacetRows(filters),
        narrowedDecks(filters, "finish")
          .select([
            sql<number>`count(*) filter (where p.rank <= 1)::int`.as("top1"),
            sql<number>`count(*) filter (where p.rank <= 4)::int`.as("top4"),
            sql<number>`count(*) filter (where p.rank <= 8)::int`.as("top8"),
            sql<number>`count(*) filter (where p.rank <= 16)::int`.as("top16"),
          ])
          .executeTakeFirstOrThrow(),
        narrowedDecks(filters, "countries")
          .select("me.country")
          .distinct()
          .where("me.country", "is not", null)
          .execute(),
      ]);
      const byBound: Record<number, number> = {
        1: finishes.top1,
        4: finishes.top4,
        8: finishes.top8,
        16: finishes.top16,
      };
      return {
        events,
        legends,
        finishes: FINISH_BOUNDS.map((bound) => ({ value: bound, count: byBound[bound] ?? 0 })),
        countries: countries
          .map((row) => row.country)
          .filter((country): country is string => country !== null)
          .toSorted((left, right) => left.localeCompare(right)),
      };
    },

    /**
     * One event's whole field, or the page of the grid the caller is showing,
     * never the whole archive. The sideboard stays its own row.
     */
    async allDeckCards(filters: MetaDeckCardFilters = {}): Promise<MetaDeckCardRow[]> {
      const isSideboard = sql<boolean>`dc.zone = ${sql.lit(WellKnown.deckZone.SIDEBOARD)}`;
      const { eventSlug } = filters;
      const rows = await db
        .selectFrom("deckCards as dc")
        .select(({ fn }) => [
          "dc.deckId",
          "dc.cardId",
          fn.sum<string>("dc.quantity").as("quantity"),
          isSideboard.as("sideboard"),
        ])
        // `exists`, not a join: a join would double quantities if
        // `uq_meta_event_players_deck` ever allows more than one standings
        // row per deck.
        .where((eb) =>
          eventSlug === undefined
            ? eb(
                "dc.deckId",
                "in",
                orderedDeckPage(narrowedDecks(filters).select("p.deckId"), filters).$narrowType<{
                  deckId: string;
                }>(),
              )
            : eb.exists(
                eb
                  .selectFrom("metaEventPlayers as p")
                  .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
                  .select(sql.lit(1).as("x"))
                  .whereRef("p.deckId", "=", "dc.deckId")
                  .where("me.slug", "=", eventSlug),
              ),
        )
        .groupBy(["dc.deckId", "dc.cardId", isSideboard])
        .orderBy("dc.deckId")
        .orderBy("dc.cardId")
        .orderBy(isSideboard)
        .execute();
      return rows.map((row) => ({
        deckId: row.deckId,
        cardId: row.cardId,
        quantity: Number(row.quantity),
        sideboard: row.sideboard,
      }));
    },

    contextForDeck(deckId: string): Promise<MetaDeckContextRow | undefined> {
      return db
        .selectFrom("metaEventPlayers as p")
        .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
        .leftJoin("uvsgamesPlayers as up", "up.id", "p.uvsgamesPlayerId")
        .select([
          "p.id as playerId",
          "p.listStatus",
          resolvedPlayerName.as("playerName"),
          "p.sourceIdentity",
          "p.rank",
          "p.rankIsTier",
          "p.wins",
          "p.losses",
          "p.draws",
          "me.slug as eventSlug",
          "me.name as eventName",
          "me.eventDate",
          "me.format as eventFormat",
          "me.tier as eventTier",
          "me.country as eventCountry",
          "me.playerCount as eventPlayerCount",
        ])
        .where("p.deckId", "=", deckId)
        .executeTakeFirst();
    },

    /** Every archived deck the event's standings rows point at, three queries for the whole field. */
    async deckStatesForEvent(eventId: string): Promise<Map<string, MetaStoredPlayerDeck>> {
      const players = await db
        .selectFrom("metaEventPlayers")
        .select(["id", "deckId", "listStatus"])
        .where("metaEventId", "=", eventId)
        .where("deckId", "is not", null)
        .execute();
      if (players.length === 0) {
        return new Map();
      }

      const deckIds = players.map((player) => player.deckId as string);
      const decks = await db
        .selectFrom("decks")
        .select(["id", "name", "format"])
        .where("id", "in", deckIds)
        .execute();
      const cards = await db
        .selectFrom("deckCards")
        .select(["deckId", "cardId", "zone", "quantity", "preferredPrintingId"])
        .where("deckId", "in", deckIds)
        .execute();

      const byDeck = new Map(decks.map((deck) => [deck.id, deck]));
      const cardsByDeck = Map.groupBy(cards, (card) => card.deckId);
      const states = new Map<string, MetaStoredPlayerDeck>();
      for (const player of players) {
        const deck = byDeck.get(player.deckId as string);
        if (deck === undefined) {
          continue;
        }
        states.set(player.id, {
          deckId: deck.id,
          listStatus: player.listStatus,
          name: deck.name,
          format: deck.format,
          cards: cardsByDeck.get(deck.id) ?? [],
        });
      }
      return states;
    },

    /**
     * Attaches a list, or replaces the one already there.
     *
     * `shareToken` is written only when the deck is created; a replacement
     * keeps the token published links already use. `preserveName` keeps the
     * existing name across a re-promote. An unchanged card list is left
     * alone, not deleted and reinserted.
     */
    setPlayerDeck(
      playerId: string,
      deck: MetaArchivedDeckInput,
      shareToken: string,
      options?: { preserveName?: boolean },
    ): Promise<{ deckId: string } | undefined> {
      return db.transaction().execute(async (trx) => {
        const player = await trx
          .selectFrom("metaEventPlayers")
          .select(["deckId", "listStatus"])
          .where("id", "=", playerId)
          .executeTakeFirst();
        if (!player) {
          return;
        }

        if (player.deckId === null) {
          const deckId = await insertDeckForPlayer(trx, playerId, deck, shareToken);
          return { deckId };
        }

        const current = await trx
          .selectFrom("decks")
          .select(["name", "format", "formatConfig"])
          .where("id", "=", player.deckId)
          .executeTakeFirst();
        const name = options?.preserveName === true ? (current?.name ?? deck.name) : deck.name;
        if (current === undefined || current.name !== name || current.format !== deck.format) {
          await trx
            .updateTable("decks")
            .set({
              name,
              format: deck.format,
              formatConfig: deck.formatConfig,
              updatedAt: sql`now()`,
            })
            .where("id", "=", player.deckId)
            .execute();
        }

        const existing = await trx
          .selectFrom("deckCards")
          .select(["cardId", "zone", "quantity", "preferredPrintingId"])
          .where("deckId", "=", player.deckId)
          .execute();
        const incoming = mergeDeckCards(deck.cards);
        if (!sameDeckCards(existing, incoming)) {
          await trx.deleteFrom("deckCards").where("deckId", "=", player.deckId).execute();
          await trx
            .insertInto("deckCards")
            .values(incoming.map((card) => ({ deckId: player.deckId as string, ...card })))
            .execute();
        }
        if (player.listStatus !== deck.listStatus) {
          await trx
            .updateTable("metaEventPlayers")
            .set({ listStatus: deck.listStatus })
            .where("id", "=", playerId)
            .execute();
        }

        return { deckId: player.deckId };
      });
    },

    async renamePlayerDeck(playerId: string, name: string): Promise<boolean> {
      const player = await db
        .selectFrom("metaEventPlayers")
        .select("deckId")
        .where("id", "=", playerId)
        .executeTakeFirst();
      if (!player || player.deckId === null) {
        return false;
      }
      await db
        .updateTable("decks")
        .set({ name, updatedAt: sql`now()` })
        .where("id", "=", player.deckId)
        .execute();
      return true;
    },

    /**
     * Detaches and deletes a standings row's list. The reference is cleared
     * first because `meta_event_players.deck_id` is ON DELETE RESTRICT: a
     * standings row must never disappear because someone removed a decklist.
     */
    clearPlayerDeck(playerId: string): Promise<boolean> {
      return db.transaction().execute(async (trx) => {
        const player = await trx
          .selectFrom("metaEventPlayers")
          .select("deckId")
          .where("id", "=", playerId)
          .executeTakeFirst();
        if (!player) {
          return false;
        }
        if (player.deckId === null) {
          return true;
        }
        await trx
          .updateTable("metaEventPlayers")
          .set({ deckId: null, listStatus: "none" })
          .where("id", "=", playerId)
          .execute();
        await trx.deleteFrom("decks").where("id", "=", player.deckId).execute();
        return true;
      });
    },
  };
}
