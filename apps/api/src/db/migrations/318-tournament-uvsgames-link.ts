import type { Kysely } from "kysely";
import { sql } from "kysely";

/** ADR-052: the UVS Games event a hosted tournament also ran as. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE tournaments
      ADD COLUMN uvsgames_event_id text,
      ADD CONSTRAINT chk_tournaments_uvsgames_event_id
        CHECK (uvsgames_event_id IS NULL OR uvsgames_event_id ~ '^[1-9][0-9]{0,11}$')
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE tournaments DROP COLUMN uvsgames_event_id`.execute(db);
}
