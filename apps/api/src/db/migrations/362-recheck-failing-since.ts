import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE uvsgames_event_checks ADD COLUMN failing_since timestamptz`.execute(db);
  await sql`ALTER TABLE playloltcg_event_checks ADD COLUMN failing_since timestamptz`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE playloltcg_event_checks DROP COLUMN failing_since`.execute(db);
  await sql`ALTER TABLE uvsgames_event_checks DROP COLUMN failing_since`.execute(db);
}
