import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

const CATALOG_SHAPE_VERSION = "7";

/**
 * Migrations 343 and 345 list which tables bump which scope. A table a catalog read
 * starts depending on needs the trigger in a new migration.
 */
export function catalogVersionsRepo(db: Kysely<Database>) {
  return {
    /** Includes `current_date` for `setReleased`'s derived flag; {@link catalogResponseVersion} must not inherit it. */
    async catalogContentVersion(): Promise<string> {
      const result = await sql<{ token: string }>`
        SELECT md5(${sql.lit(CATALOG_SHAPE_VERSION)} || '|' || version::text || '|' || current_date::text) AS token
          FROM catalog_versions WHERE scope = 'content'
      `.execute(db);
      return result.rows[0]?.token ?? "";
    },

    async catalogResponseVersion(): Promise<string> {
      const result = await sql<{ token: string }>`
        SELECT md5(${sql.lit(CATALOG_SHAPE_VERSION)} || '|' || version::text) AS token
          FROM catalog_versions WHERE scope = 'response'
      `.execute(db);
      return result.rows[0]?.token ?? "";
    },
  };
}
