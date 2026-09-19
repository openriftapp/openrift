import type { Kysely } from "kysely";
import { sql } from "kysely";

/** What the per-event endpoint said about a row the listing stopped returning. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE uvsgames_events
      ADD COLUMN missing_probe text,
      ADD CONSTRAINT chk_uvsgames_events_missing_probe
        CHECK (missing_probe IN ('found', 'absent')),
      ADD CONSTRAINT chk_uvsgames_events_missing_probe_needs_missing
        CHECK (missing_probe IS NULL OR missing_since IS NOT NULL)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE uvsgames_events DROP COLUMN missing_probe`.execute(db);
}
