import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

const CATALOG_SHAPE_VERSION = "8";

/**
 * Migrations 343, 345 and 360 list which tables and columns bump which scope. A table, or an
 * image column outside 360's lists, that a catalog read starts depending on needs a new migration.
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
