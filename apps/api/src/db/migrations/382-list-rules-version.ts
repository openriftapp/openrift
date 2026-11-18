import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE lists
      ADD COLUMN rules_version integer NOT NULL DEFAULT 0,
      ADD CONSTRAINT chk_lists_rules_version_nonnegative CHECK (rules_version >= 0)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE lists DROP COLUMN rules_version`.execute(db);
}
