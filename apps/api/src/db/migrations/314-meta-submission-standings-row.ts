import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("meta_submissions")
    .addColumn("meta_event_player_id", "uuid", (col) =>
      col.references("meta_event_players.id").onDelete("set null"),
    )
    .execute();
  await db.schema
    .createIndex("idx_meta_submissions_event_pending")
    .on("meta_submissions")
    .column("meta_event_id")
    .where(sql.ref("status"), "=", "pending")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_meta_submissions_event_pending").execute();
  await db.schema.alterTable("meta_submissions").dropColumn("meta_event_player_id").execute();
}
