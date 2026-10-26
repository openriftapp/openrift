import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

/**
 * Catalog reads join the materialized views, so a refresh changes the response
 * after the write that triggered it has already bumped the version.
 */
async function bumpCatalogVersions(db: Kysely<Database>): Promise<void> {
  await sql`SELECT bump_catalog_versions(ARRAY['response', 'content'])`.execute(db);
}

export function catalogRefreshRepo(db: Kysely<Database>) {
  return {
    async refreshCardAggregates(): Promise<void> {
      await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_card_aggregates`.execute(db);
      await bumpCatalogVersions(db);
    },

    /**
     * Must run after anything that changes ranking: printings themselves, or the
     * `sort_order` of sets / finishes / card_sizes / languages / markers.
     */
    async refreshCanonicalRank(): Promise<void> {
      await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_printing_sides_canonical_rank`.execute(
        db,
      );
      await bumpCatalogVersions(db);
    },

    /** Add any new catalog-derived materialized view here; callers refresh them as a set. */
    async refreshCatalogViews(): Promise<void> {
      // Not `this.refresh…()`: instrumentRepo rebinds these methods onto a new
      // object, so a `this` reference here would not survive the wrapping.
      await Promise.all([
        sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_card_aggregates`.execute(db),
        sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_printing_sides_canonical_rank`.execute(db),
        sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_printing_foil_twins`.execute(db),
      ]);
      await bumpCatalogVersions(db);
    },
  };
}
