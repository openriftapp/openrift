import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("image_files").addColumn("fingerprint", "text").execute();
  await db.schema
    .alterTable("candidate_printings")
    .addColumn("image_fingerprint", "text")
    .addColumn("image_fingerprint_url", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("candidate_printings")
    .dropColumn("image_fingerprint")
    .dropColumn("image_fingerprint_url")
    .execute();
  await db.schema.alterTable("image_files").dropColumn("fingerprint").execute();
}
