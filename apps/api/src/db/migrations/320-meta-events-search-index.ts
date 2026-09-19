import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX idx_meta_events_search_trgm
      ON meta_events USING gin (
        name gin_trgm_ops,
        organizer gin_trgm_ops,
        location gin_trgm_ops
      )
  `.execute(db);

  await sql`CREATE INDEX idx_meta_events_tier ON meta_events (tier)`.execute(db);
  await sql`CREATE INDEX idx_meta_events_country ON meta_events (country)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_meta_events_country`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_meta_events_tier`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_meta_events_search_trgm`.execute(db);
}
