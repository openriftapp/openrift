import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

/** The two category tables share one shape; `tagTable` is the tag table whose `category_id` points at it. */
export interface TagCategoryTables {
  table: "tagCategories" | "customTagCategories";
  tagTable: "tagDefinitions" | "customTags";
}

/*
 * Queries cast `table`/`tagTable` to one member of the union for typing; the
 * runtime value still supplies the real table name in the emitted SQL.
 */
export function tagCategoryRepo(db: Kysely<Database>, tables: TagCategoryTables) {
  const table = tables.table as "tagCategories";
  const tagTable = tables.tagTable as "tagDefinitions";

  return {
    listAll() {
      return db.selectFrom(table).selectAll().orderBy("sortOrder").orderBy("label").execute();
    },

    getById(id: string) {
      return db.selectFrom(table).selectAll().where("id", "=", id).executeTakeFirst();
    },

    getBySlug(slug: string) {
      return db.selectFrom(table).selectAll().where("slug", "=", slug).executeTakeFirst();
    },

    async getMaxSortOrder(): Promise<number> {
      const row = await db
        .selectFrom(table)
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
        .insertInto(table)
        .values({
          slug: values.slug,
          label: values.label,
          description: values.description ?? null,
          ...(values.sortOrder === undefined ? {} : { sortOrder: values.sortOrder }),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async update(
      id: string,
      updates: {
        slug?: string;
        label?: string;
        description?: string | null;
      },
    ): Promise<void> {
      await db.updateTable(table).set(updates).where("id", "=", id).execute();
    },

    async deleteById(id: string): Promise<boolean> {
      const result = await db.deleteFrom(table).where("id", "=", id).executeTakeFirst();
      return result.numDeletedRows > 0n;
    },

    async isInUse(id: string): Promise<boolean> {
      const row = await db
        .selectFrom(tagTable)
        .select(sql<number>`1`.as("one"))
        .where("categoryId", "=", id)
        .limit(1)
        .executeTakeFirst();
      return row !== undefined;
    },
  };
}
