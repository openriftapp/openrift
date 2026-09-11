import { TBA_SET_SLUG } from "@openrift/shared/printing-code";
import type { SetReleases } from "@openrift/shared/set-release";
import type { Kysely, Selectable, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { SetsTable } from "../../../db/tables/catalog.js";

/** No `released` boolean: clients derive it from the dates via `isReleased`. */
type CatalogSetRow = Pick<Selectable<SetsTable>, "id" | "slug" | "name" | "setType"> & {
  releases: SetReleases;
};

/**
 * The per-language release map for a set, as a correlated subquery so the set
 * reads stay one round trip.
 */
function releasesJson() {
  return sql<SetReleases>`coalesce((
    SELECT jsonb_object_agg(
      r.language,
      jsonb_build_object('releasedAt', r.released_at, 'precision', r.precision)
    )
    FROM set_releases r
    WHERE r.set_id = sets.id
  ), '{}'::jsonb)`.as("releases");
}

/** The placeholder set is admin scaffolding until a printing lands in it. */
function isPublicSet() {
  return sql<SqlBool>`(sets.slug <> ${TBA_SET_SLUG} OR EXISTS (
    SELECT 1 FROM printings WHERE printings.set_id = sets.id
  ))`;
}

export function catalogSetsRepo(db: Kysely<Database>) {
  return {
    async sets(): Promise<CatalogSetRow[]> {
      const rows = await db
        .selectFrom("sets")
        .select(["id", "slug", "name", "setType", releasesJson()])
        .where(isPublicSet())
        .orderBy("sortOrder")
        .execute();
      return rows;
    },

    async setsByIds(ids: string[]): Promise<CatalogSetRow[]> {
      if (ids.length === 0) {
        return [];
      }
      const rows = await db
        .selectFrom("sets")
        .select(["id", "slug", "name", "setType", releasesJson()])
        .where("id", "in", ids)
        .orderBy("sortOrder")
        .execute();
      return rows;
    },

    async setBySlug(slug: string): Promise<CatalogSetRow | undefined> {
      return await db
        .selectFrom("sets")
        .select(["id", "slug", "name", "setType", releasesJson()])
        .where("slug", "=", slug)
        .where(isPublicSet())
        .executeTakeFirst();
    },

    async allSetSitemapEntries(): Promise<{ slug: string; updatedAt: string }[]> {
      const rows = await db
        .selectFrom("sets")
        .select(["slug", "updatedAt"])
        .where(isPublicSet())
        .orderBy("sortOrder")
        .execute();
      return rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() }));
    },
  };
}
