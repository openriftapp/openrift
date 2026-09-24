import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE collections
      ADD COLUMN purpose text CHECK (purpose IN ('marketplace_orders'))
  `.execute(db);
  await sql`
    ALTER TABLE collections
      ADD CONSTRAINT chk_collections_purpose_personal CHECK (purpose IS NULL OR group_id IS NULL)
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX uq_collections_user_purpose ON collections (user_id, purpose)
      WHERE purpose IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS uq_collections_user_purpose`.execute(db);
  await sql`ALTER TABLE collections DROP COLUMN IF EXISTS purpose`.execute(db);
}
