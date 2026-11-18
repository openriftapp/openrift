import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE friend_group_uvsgames_shops DROP COLUMN added_by_user_id`.execute(db);
  await sql`ALTER TABLE friend_group_playriftbound_shops DROP COLUMN added_by_user_id`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ["friend_group_uvsgames_shops", "friend_group_playriftbound_shops"]) {
    await sql`
      ALTER TABLE ${sql.table(table)}
        ADD COLUMN added_by_user_id text,
        ADD CONSTRAINT ${sql.id(`fk_${table}_added_by_user_id`)}
          FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    `.execute(db);
  }
}
