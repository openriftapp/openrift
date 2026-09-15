import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Personal calendar-feed links for a group's tournaments and shop events. The
 * token is the only credential a calendar app sends, so a feed belongs to one
 * membership and is deleted with it.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("friend_group_calendar_feeds")
    .addColumn("token", "text", (col) => col.primaryKey())
    .addColumn("group_id", "uuid", (col) => col.notNull())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("kind", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .addCheckConstraint(
      "chk_friend_group_calendar_feeds_kind",
      sql`kind IN ('tournaments', 'shop_events')`,
    )
    .addCheckConstraint("chk_friend_group_calendar_feeds_token", sql`token <> ''`)
    .addUniqueConstraint("uq_friend_group_calendar_feeds_member_kind", [
      "group_id",
      "user_id",
      "kind",
    ])
    .execute();

  await db.schema
    .alterTable("friend_group_calendar_feeds")
    .addForeignKeyConstraint(
      "friend_group_calendar_feeds_member_fkey",
      ["group_id", "user_id"],
      "friend_group_members",
      ["group_id", "user_id"],
    )
    .onDelete("cascade")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("friend_group_calendar_feeds").execute();
}
