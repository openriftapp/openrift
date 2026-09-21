import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * The planner ignores statistics of partial indexes, so without these it guesses
 * 0.5% of the table per player key and skips `idx_meta_event_players_player_key`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE STATISTICS meta_event_players_player_key_stats
      ON (regexp_replace(source_identity, '#\\d+$', ''))
      FROM meta_event_players
  `.execute(db);
  await sql`ANALYZE meta_event_players`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP STATISTICS IF EXISTS meta_event_players_player_key_stats`.execute(db);
}
