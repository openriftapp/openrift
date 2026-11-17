import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX uq_meta_event_overlays_admin_edit
      ON meta_event_overlays (meta_event_id, submitted_by_user_id)
      WHERE origin = 'admin_edit' AND status = 'accepted'
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX uq_meta_event_player_overlays_admin_edit
      ON meta_event_player_overlays (meta_event_player_id, submitted_by_user_id)
      WHERE origin = 'admin_edit' AND status = 'accepted'
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX uq_meta_event_player_overlays_admin_edit, uq_meta_event_overlays_admin_edit
  `.execute(db);
}
