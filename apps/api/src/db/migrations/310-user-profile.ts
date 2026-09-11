import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("bio", "text")
    .addColumn("profile_show_riot_id", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("profile_show_collection", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("profile_show_last_active", "boolean", (col) => col.notNull().defaultTo(true))
    .execute();
  await db.schema
    .alterTable("users")
    .addCheckConstraint(
      "chk_users_bio",
      sql`bio IS NULL OR (bio <> '' AND char_length(bio) <= 200)`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("users")
    .dropColumn("bio")
    .dropColumn("profile_show_riot_id")
    .dropColumn("profile_show_collection")
    .dropColumn("profile_show_last_active")
    .execute();
}
