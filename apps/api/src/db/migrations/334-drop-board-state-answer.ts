import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("board_states").dropColumn("answer").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("board_states").addColumn("answer", "text").execute();
}
