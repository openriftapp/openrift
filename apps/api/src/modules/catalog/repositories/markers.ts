import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { reorderBySortOrder } from "../../../repositories/query-helpers.js";

export function markersRepo(db: Kysely<Database>) {
  return {
    listAll() {
      return db.selectFrom("markers").selectAll().orderBy("sortOrder").orderBy("label").execute();
    },

    getById(id: string) {
      return db.selectFrom("markers").selectAll().where("id", "=", id).executeTakeFirst();
    },

    getBySlug(slug: string) {
      return db.selectFrom("markers").selectAll().where("slug", "=", slug).executeTakeFirst();
    },

    listBySlugs(slugs: readonly string[]) {
      if (slugs.length === 0) {
        return Promise.resolve([]);
      }
      return db.selectFrom("markers").selectAll().where("slug", "in", slugs).execute();
    },

    async getMaxSortOrder(): Promise<number> {
      const row = await db
        .selectFrom("markers")
        .select((eb) => eb.fn.max("sortOrder").as("maxSortOrder"))
        .executeTakeFirst();
      return row?.maxSortOrder ?? -1;
    },

    create(values: {
      slug: string;
      label: string;
      description?: string | null;
      sortOrder?: number;
    }) {
      return db
        .insertInto("markers")
        .values({
          slug: values.slug,
          label: values.label,
          description: values.description ?? null,
          ...(values.sortOrder === undefined ? {} : { sortOrder: values.sortOrder }),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    reorder(ids: readonly string[]): Promise<void> {
      return reorderBySortOrder(db, {
        table: "markers",
        keyColumn: "id",
        keys: ids,
        keyType: "uuid",
      });
    },

    update(
      id: string,
      updates: { slug?: string; label?: string; description?: string | null; updatedAt?: Date },
    ) {
      return db.updateTable("markers").set(updates).where("id", "=", id).executeTakeFirstOrThrow();
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db.deleteFrom("markers").where("id", "=", id).executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    isInUse(id: string) {
      return db
        .selectFrom("faces")
        .select("faces.id")
        .where(
          sql<boolean>`faces.marker_slugs @> ARRAY[(SELECT m.slug FROM markers m WHERE m.id = ${id})]`,
        )
        .limit(1)
        .executeTakeFirst();
    },

    async setForPrinting(printingId: string, markerIds: readonly string[]): Promise<void> {
      await db
        .updateTable("faces")
        .set({
          markerSlugs: sql<string[]>`COALESCE(
            (SELECT array_agg(m.slug) FROM markers m WHERE m.id = ANY(${[...markerIds]}::uuid[])),
            '{}'::text[]
          )`,
        })
        .where("id", "=", (eb) =>
          eb.selectFrom("printings").select("face1Id").where("printings.id", "=", printingId),
        )
        .execute();
    },
  };
}
