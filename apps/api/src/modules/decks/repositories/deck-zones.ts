import type { Kysely } from "kysely";

import type { Database } from "../../../db/tables.js";
import { reorderBySortOrder } from "../../../repositories/query-helpers.js";

export function deckZonesRepo(db: Kysely<Database>) {
  return {
    listAll() {
      return db.selectFrom("deckZones").selectAll().orderBy("sortOrder").execute();
    },

    reorder(slugs: readonly string[]): Promise<void> {
      return reorderBySortOrder(db, { table: "deckZones", keyColumn: "slug", keys: slugs });
    },

    update(slug: string, updates: { label?: string }) {
      return db
        .updateTable("deckZones")
        .set(updates)
        .where("slug", "=", slug)
        .executeTakeFirstOrThrow();
    },
  };
}
