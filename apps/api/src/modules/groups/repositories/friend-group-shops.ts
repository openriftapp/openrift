import type { GroupShopSource } from "@openrift/shared/group-shops";
import type { Kysely, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { containsPattern } from "../../../lib/like-pattern.js";

export interface GroupShopRow {
  source: GroupShopSource;
  storeId: string;
  name: string;
  location: string | null;
  upcomingCount: number;
  nextEventAt: Date | null;
}

export interface ShopSearchRow {
  source: GroupShopSource;
  storeId: string;
  name: string;
  location: string | null;
  upcomingCount: number;
}

export interface ShopEventRow {
  source: GroupShopSource;
  externalId: string;
  name: string;
  startAt: Date;
  storeId: string;
  storeName: string;
  /** Free text, or playriftbound's enum value (`CONSTRUCTED`). */
  eventFormat: string | null;
}

export interface ShopFeedEventRow {
  source: GroupShopSource;
  externalId: string;
  name: string;
  startAt: Date;
  endAtEstimate: Date | null;
  storeName: string;
  location: string | null;
  eventFormat: string | null;
}

const SEARCH_LIMIT = 20;

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}

function byStart<T extends { startAt: Date; externalId: string }>(a: T, b: T): number {
  return a.startAt.getTime() - b.startAt.getTime() || a.externalId.localeCompare(b.externalId);
}

export function friendGroupShopsRepo(db: Kysely<Database>) {
  // The uvsgames store record carries no address, only each event row does, so
  // a uvsgames shop's address is read off its newest listing.
  async function listUvsgamesShops(groupId: string): Promise<GroupShopRow[]> {
    const rows = await db
      .selectFrom("friendGroupShops as fgs")
      .innerJoin("uvsgamesStores as s", "s.id", "fgs.uvsgamesStoreId")
      .select((eb) => [
        "s.id as storeId",
        "s.name as name",
        eb
          .selectFrom("uvsgamesEvents as le")
          .select("le.location")
          .whereRef("le.storeId", "=", "s.id")
          .where("le.location", "is not", null)
          .orderBy("le.startAt", "desc")
          .limit(1)
          .as("location"),
        eb
          .selectFrom("uvsgamesEvents as ce")
          .select((inner) => inner.fn.countAll<string>().as("value"))
          .whereRef("ce.storeId", "=", "s.id")
          .where(sql<SqlBool>`ce.start_at >= now() and ce.missing_since is null`)
          .as("upcomingCount"),
        eb
          .selectFrom("uvsgamesEvents as ne")
          .select((inner) => inner.fn.min<Date | null>("ne.startAt").as("value"))
          .whereRef("ne.storeId", "=", "s.id")
          .where(sql<SqlBool>`ne.start_at >= now() and ne.missing_since is null`)
          .as("nextEventAt"),
      ])
      .where("fgs.groupId", "=", groupId)
      .execute();
    return rows.map((row) => ({
      source: "uvsgames" as const,
      storeId: String(row.storeId),
      name: row.name,
      location: row.location ?? null,
      upcomingCount: Number(row.upcomingCount ?? 0),
      nextEventAt: row.nextEventAt ?? null,
    }));
  }

  async function listPlayriftboundShops(groupId: string): Promise<GroupShopRow[]> {
    const rows = await db
      .selectFrom("friendGroupPlayriftboundShops as fgs")
      .innerJoin("playriftboundOrganizers as o", "o.id", "fgs.organizerId")
      .select((eb) => [
        "o.id as storeId",
        "o.name as name",
        "o.address as location",
        eb
          .selectFrom("playriftboundEvents as ce")
          .select((inner) => inner.fn.countAll<string>().as("value"))
          .whereRef("ce.organizerId", "=", "o.id")
          .where(sql<SqlBool>`ce.start_at >= now() and ce.missing_since is null`)
          .as("upcomingCount"),
        eb
          .selectFrom("playriftboundEvents as ne")
          .select((inner) => inner.fn.min<Date | null>("ne.startAt").as("value"))
          .whereRef("ne.organizerId", "=", "o.id")
          .where(sql<SqlBool>`ne.start_at >= now() and ne.missing_since is null`)
          .as("nextEventAt"),
      ])
      .where("fgs.groupId", "=", groupId)
      .execute();
    return rows.map((row) => ({
      source: "playriftbound" as const,
      storeId: row.storeId,
      name: row.name,
      location: row.location,
      upcomingCount: Number(row.upcomingCount ?? 0),
      nextEventAt: row.nextEventAt ?? null,
    }));
  }

  // Only shops with a listing ahead of them are offered: a store with no
  // upcoming Riftbound event would link to a permanently empty feed.
  async function searchUvsgamesShops(pattern: string): Promise<ShopSearchRow[]> {
    const rows = await db
      .selectFrom("uvsgamesStores as s")
      .select((eb) => [
        "s.id as storeId",
        "s.name as name",
        eb
          .selectFrom("uvsgamesEvents as le")
          .select("le.location")
          .whereRef("le.storeId", "=", "s.id")
          .where("le.location", "is not", null)
          .orderBy("le.startAt", "desc")
          .limit(1)
          .as("location"),
        eb
          .selectFrom("uvsgamesEvents as ce")
          .select((inner) => inner.fn.countAll<string>().as("value"))
          .whereRef("ce.storeId", "=", "s.id")
          .where(sql<SqlBool>`ce.start_at >= now() and ce.missing_since is null`)
          .as("upcomingCount"),
      ])
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("uvsgamesEvents as me")
            .select("me.externalId")
            .whereRef("me.storeId", "=", "s.id")
            .where(sql<SqlBool>`me.start_at >= now() and me.missing_since is null`)
            .where((inner) =>
              inner.or([inner("s.name", "ilike", pattern), inner("me.location", "ilike", pattern)]),
            ),
        ),
      )
      .orderBy("s.name", "asc")
      .limit(SEARCH_LIMIT)
      .execute();
    return rows.map((row) => ({
      source: "uvsgames" as const,
      storeId: String(row.storeId),
      name: row.name,
      location: row.location ?? null,
      upcomingCount: Number(row.upcomingCount ?? 0),
    }));
  }

  async function searchPlayriftboundShops(pattern: string): Promise<ShopSearchRow[]> {
    const rows = await db
      .selectFrom("playriftboundOrganizers as o")
      .select((eb) => [
        "o.id as storeId",
        "o.name as name",
        "o.address as location",
        eb
          .selectFrom("playriftboundEvents as ce")
          .select((inner) => inner.fn.countAll<string>().as("value"))
          .whereRef("ce.organizerId", "=", "o.id")
          .where(sql<SqlBool>`ce.start_at >= now() and ce.missing_since is null`)
          .as("upcomingCount"),
      ])
      .where((eb) =>
        eb.or([
          eb("o.name", "ilike", pattern),
          eb("o.city", "ilike", pattern),
          eb("o.address", "ilike", pattern),
        ]),
      )
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("playriftboundEvents as me")
            .select("me.tournamentId")
            .whereRef("me.organizerId", "=", "o.id")
            .where(sql<SqlBool>`me.start_at >= now() and me.missing_since is null`),
        ),
      )
      .orderBy("o.name", "asc")
      .limit(SEARCH_LIMIT)
      .execute();
    return rows.map((row) => ({
      source: "playriftbound" as const,
      storeId: row.storeId,
      name: row.name,
      location: row.location,
      upcomingCount: Number(row.upcomingCount ?? 0),
    }));
  }

  /** Both sources' events from `pastDays` back; `horizonDays` bounds the future, if given. */
  async function listGroupEvents(
    groupId: string,
    pastDays: number,
    horizonDays?: number,
  ): Promise<(ShopEventRow & ShopFeedEventRow)[]> {
    const future =
      horizonDays === undefined
        ? sql<SqlBool>`true`
        : sql<SqlBool>`e.start_at < now() + make_interval(days => ${horizonDays})`;
    const [uvsgames, playriftbound] = await Promise.all([
      db
        .selectFrom("friendGroupShops as fgs")
        .innerJoin("uvsgamesStores as s", "s.id", "fgs.uvsgamesStoreId")
        .innerJoin("uvsgamesEvents as e", "e.storeId", "s.id")
        .select([
          "e.externalId as externalId",
          "e.name as name",
          "e.startAt as startAt",
          "e.endAtEstimate as endAtEstimate",
          "s.id as storeId",
          "s.name as storeName",
          "e.location as location",
          "e.eventFormat as eventFormat",
        ])
        .where("fgs.groupId", "=", groupId)
        .where("e.missingSince", "is", null)
        .where(sql<SqlBool>`e.start_at >= now() - make_interval(days => ${pastDays})`)
        .where(future)
        .execute(),
      db
        .selectFrom("friendGroupPlayriftboundShops as fgs")
        .innerJoin("playriftboundOrganizers as o", "o.id", "fgs.organizerId")
        .innerJoin("playriftboundEvents as e", "e.organizerId", "o.id")
        .select([
          "e.tournamentId as externalId",
          "e.name as name",
          "e.startAt as startAt",
          "o.id as storeId",
          "o.name as storeName",
          "o.address as location",
          "e.format as eventFormat",
        ])
        .where("fgs.groupId", "=", groupId)
        .where("e.missingSince", "is", null)
        .where(sql<SqlBool>`e.start_at >= now() - make_interval(days => ${pastDays})`)
        .where(future)
        .execute(),
    ]);
    return [
      ...uvsgames.map((row) => ({
        ...row,
        source: "uvsgames" as const,
        storeId: String(row.storeId),
      })),
      ...playriftbound.map((row) => ({
        ...row,
        source: "playriftbound" as const,
        endAtEstimate: null,
      })),
    ].toSorted(byStart);
  }

  return {
    async listShops(groupId: string): Promise<GroupShopRow[]> {
      const [uvsgames, playriftbound] = await Promise.all([
        listUvsgamesShops(groupId),
        listPlayriftboundShops(groupId),
      ]);
      return [...uvsgames, ...playriftbound].toSorted(byName);
    },

    async countShops(groupId: string): Promise<number> {
      const [uvsgames, playriftbound] = await Promise.all([
        db
          .selectFrom("friendGroupShops")
          .select((eb) => eb.fn.countAll<string>().as("total"))
          .where("groupId", "=", groupId)
          .executeTakeFirstOrThrow(),
        db
          .selectFrom("friendGroupPlayriftboundShops")
          .select((eb) => eb.fn.countAll<string>().as("total"))
          .where("groupId", "=", groupId)
          .executeTakeFirstOrThrow(),
      ]);
      return Number(uvsgames.total) + Number(playriftbound.total);
    },

    async searchShops(term: string): Promise<ShopSearchRow[]> {
      const pattern = containsPattern(term.trim());
      const [uvsgames, playriftbound] = await Promise.all([
        searchUvsgamesShops(pattern),
        searchPlayriftboundShops(pattern),
      ]);
      return [...uvsgames, ...playriftbound].toSorted(byName).slice(0, SEARCH_LIMIT);
    },

    async linkShop(values: {
      groupId: string;
      source: GroupShopSource;
      storeId: string;
      addedByUserId: string;
    }): Promise<void> {
      if (values.source === "playriftbound") {
        await db
          .insertInto("friendGroupPlayriftboundShops")
          .values({
            groupId: values.groupId,
            organizerId: values.storeId,
            addedByUserId: values.addedByUserId,
          })
          .onConflict((oc) => oc.columns(["groupId", "organizerId"]).doNothing())
          .execute();
        return;
      }
      await db
        .insertInto("friendGroupShops")
        .values({
          groupId: values.groupId,
          uvsgamesStoreId: Number(values.storeId),
          addedByUserId: values.addedByUserId,
        })
        .onConflict((oc) => oc.columns(["groupId", "uvsgamesStoreId"]).doNothing())
        .execute();
    },

    async unlinkShop(groupId: string, source: GroupShopSource, storeId: string): Promise<boolean> {
      const result =
        source === "playriftbound"
          ? await db
              .deleteFrom("friendGroupPlayriftboundShops")
              .where("groupId", "=", groupId)
              .where("organizerId", "=", storeId)
              .executeTakeFirst()
          : await db
              .deleteFrom("friendGroupShops")
              .where("groupId", "=", groupId)
              .where("uvsgamesStoreId", "=", Number(storeId))
              .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    async storeExists(source: GroupShopSource, storeId: string): Promise<boolean> {
      const row =
        source === "playriftbound"
          ? await db
              .selectFrom("playriftboundOrganizers")
              .select("id")
              .where("id", "=", storeId)
              .executeTakeFirst()
          : await db
              .selectFrom("uvsgamesStores")
              .select("id")
              .where("id", "=", Number(storeId))
              .executeTakeFirst();
      return row !== undefined;
    },

    listFeedEvents(groupId: string, pastDays: number): Promise<ShopFeedEventRow[]> {
      return listGroupEvents(groupId, pastDays);
    },

    listEventsInWindow(
      groupId: string,
      pastDays: number,
      horizonDays: number,
    ): Promise<ShopEventRow[]> {
      return listGroupEvents(groupId, pastDays, horizonDays);
    },

    /** uvsgames only: it feeds the suggestions for linking a tournament to its uvsgames event. */
    async listEventsBetween(groupId: string, from: Date, to: Date): Promise<ShopEventRow[]> {
      const rows = await db
        .selectFrom("friendGroupShops as fgs")
        .innerJoin("uvsgamesStores as s", "s.id", "fgs.uvsgamesStoreId")
        .innerJoin("uvsgamesEvents as e", "e.storeId", "s.id")
        .select([
          "e.externalId as externalId",
          "e.name as name",
          "e.startAt as startAt",
          "s.id as storeId",
          "s.name as storeName",
          "e.eventFormat as eventFormat",
        ])
        .where("fgs.groupId", "=", groupId)
        .where(sql<SqlBool>`date_trunc('milliseconds', e.start_at) >= ${from}`)
        .where(sql<SqlBool>`date_trunc('milliseconds', e.start_at) < ${to}`)
        .orderBy("e.startAt", "asc")
        .orderBy("e.externalId", "asc")
        .execute();
      return rows.map((row) => ({
        ...row,
        source: "uvsgames" as const,
        storeId: String(row.storeId),
      }));
    },
  };
}
