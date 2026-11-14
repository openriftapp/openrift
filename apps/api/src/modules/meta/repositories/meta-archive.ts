import type { MetaEventTier } from "@openrift/shared/types/enums";
import type { Kysely, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { MetaLegendSitemapRow } from "./meta-legends.js";
import { metaLegendsRepo } from "./meta-legends.js";
import type { MetaScopeFilters } from "./meta-shared.js";
import {
  citedBy,
  foldedPlayerIdentity,
  HAS_DECKS,
  HAS_STANDINGS,
  scopeConditions,
  UPCOMING,
} from "./meta-shared.js";

const SITEMAP_TIERS = ["premier", "competitive"] as const;

export type MetaEventTierCounts = Record<MetaEventTier, number>;

export function metaArchiveRepo(db: Kysely<Database>) {
  function scopedEvents(scope: MetaScopeFilters) {
    let query = db.selectFrom("metaEvents as me");
    for (const condition of scopeConditions(scope)) {
      query = query.where(condition);
    }
    return query;
  }

  return {
    /**
     * The archive's side of the sync funnel. A given provider narrows events
     * and decks to the ones its citation links, so a source's "Published" is
     * the archive it fed.
     */
    async archiveOverview(provider?: string): Promise<{
      events: number;
      eventsWithStandings: number;
      eventsWithDecklists: number;
      decks: number;
      addedLast7Days: number;
    }> {
      let base = db.selectFrom("metaEvents as me");
      if (provider !== undefined) {
        base = base.where(citedBy(provider));
      }
      const row = await base
        .select((eb) => [
          eb.fn.countAll<string>().as("events"),
          sql<string>`count(*) filter (where ${HAS_STANDINGS})`.as("eventsWithStandings"),
          sql<string>`count(*) filter (where ${HAS_DECKS})`.as("eventsWithDecklists"),
          provider === undefined
            ? sql<string>`(select count(*) from meta_event_players p where p.deck_id is not null)`.as(
                "decks",
              )
            : sql<string>`(
                select count(*) from meta_event_players p
                  join meta_events me on me.id = p.meta_event_id
                 where p.deck_id is not null and ${citedBy(provider)}
              )`.as("decks"),
          sql<string>`count(*) filter (where date_trunc('milliseconds', me.created_at) > now() - interval '7 days')`.as(
            "addedLast7Days",
          ),
        ])
        .executeTakeFirstOrThrow();
      return {
        events: Number(row.events),
        eventsWithStandings: Number(row.eventsWithStandings),
        eventsWithDecklists: Number(row.eventsWithDecklists),
        decks: Number(row.decks),
        addedLast7Days: Number(row.addedLast7Days),
      };
    },

    async latestResultDate(scope: MetaScopeFilters = {}): Promise<string | null> {
      const row = await scopedEvents(scope)
        .select((eb) => eb.fn.max("me.eventDate").as("latest"))
        .where(sql<SqlBool>`not ${UPCOMING}`)
        .where(HAS_STANDINGS)
        .executeTakeFirst();
      return row?.latest ?? null;
    },

    /** Events per tier in scope, every tier present whether or not an event sits at it. */
    async eventTierCounts(scope: MetaScopeFilters = {}): Promise<{
      all: MetaEventTierCounts;
      withResults: MetaEventTierCounts;
    }> {
      const rows = await scopedEvents(scope)
        .select((eb) => [
          "me.tier",
          eb.cast<number>(eb.fn.countAll(), "integer").as("count"),
          sql<number>`count(*) filter (where ${HAS_STANDINGS})::int`.as("withResults"),
        ])
        .groupBy("me.tier")
        .execute();
      const all: MetaEventTierCounts = { premier: 0, competitive: 0, local: 0 };
      const withResults: MetaEventTierCounts = { premier: 0, competitive: 0, local: 0 };
      for (const row of rows) {
        all[row.tier as MetaEventTier] = row.count;
        withResults[row.tier as MetaEventTier] = row.withResults;
      }
      return { all, withResults };
    },

    /**
     * `updatedAt` drives the `<lastmod>` the sitemap generator emits. Store
     * night events, their decks and their players are excluded while the archive
     * ramps up, and so are events with no standings row: their pages are
     * `noindex`. Legends keep every tier.
     */
    async sitemapEntries(): Promise<{
      events: { slug: string; updatedAt: string }[];
      decks: { slug: string; updatedAt: string }[];
      legends: MetaLegendSitemapRow[];
      players: { slug: string; updatedAt: string }[];
    }> {
      const [events, decks, legends, players] = await Promise.all([
        db
          .selectFrom("metaEvents as me")
          .select(["me.slug", "me.updatedAt"])
          .where("me.tier", "in", SITEMAP_TIERS)
          .where(HAS_STANDINGS)
          .orderBy("me.eventDate", "desc")
          .execute(),
        db
          .selectFrom("metaEventPlayers as p")
          .innerJoin("decks as d", "d.id", "p.deckId")
          .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
          .select(["d.shareToken as slug", "d.updatedAt"])
          .where("d.shareToken", "is not", null)
          .where("me.tier", "in", SITEMAP_TIERS)
          .$narrowType<{ slug: string }>()
          .orderBy("d.shareToken")
          .execute(),
        metaLegendsRepo(db).archiveLegends(),
        // Store nights hold most players: listing them triples the sitemap.
        db
          .selectFrom("metaEventPlayers as p")
          .innerJoin("metaEvents as me", "me.id", "p.metaEventId")
          .select([foldedPlayerIdentity.as("slug"), sql<Date>`max(p.updated_at)`.as("updatedAt")])
          .where("p.sourceIdentity", "is not", null)
          .where("me.tier", "in", SITEMAP_TIERS)
          .groupBy(foldedPlayerIdentity)
          .orderBy(foldedPlayerIdentity)
          .execute(),
      ]);
      const toEntry = (row: { slug: string; updatedAt: Date }) => ({
        slug: row.slug,
        updatedAt: row.updatedAt.toISOString(),
      });
      return {
        events: events.map((row) => toEntry(row)),
        decks: decks.map((row) => toEntry(row)),
        legends,
        players: players.map((row) => toEntry(row)),
      };
    },
  };
}
