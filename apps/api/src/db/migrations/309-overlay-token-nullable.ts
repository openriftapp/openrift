import type { Kysely } from "kysely";
import { sql } from "kysely";

// A null token means the browser source link is turned off; enabling it again
// mints a fresh one, so a leaked URL dies for good.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("overlay_channels")
    .alterColumn("token", (col) => col.dropNotNull())
    .execute();

  await sql`
    ALTER TABLE overlay_channels DROP CONSTRAINT chk_overlay_channels_token_not_empty
  `.execute(db);

  await sql`
    ALTER TABLE overlay_channels
    ADD CONSTRAINT chk_overlay_channels_token_not_empty CHECK (token IS NULL OR token <> '')
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE overlay_channels
    SET token = replace(gen_random_uuid()::text, '-', '')
    WHERE token IS NULL
  `.execute(db);

  await sql`
    ALTER TABLE overlay_channels DROP CONSTRAINT chk_overlay_channels_token_not_empty
  `.execute(db);

  await sql`
    ALTER TABLE overlay_channels
    ADD CONSTRAINT chk_overlay_channels_token_not_empty CHECK (token <> '')
  `.execute(db);

  await db.schema
    .alterTable("overlay_channels")
    .alterColumn("token", (col) => col.setNotNull())
    .execute();
}
