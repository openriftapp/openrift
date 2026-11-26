import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE INDEX idx_meta_event_players_created_at ON meta_event_players (created_at)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX idx_meta_event_players_created_at`.execute(db);
}
