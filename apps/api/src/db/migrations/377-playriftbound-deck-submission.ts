import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE playriftbound_events
      ADD COLUMN deck_submission_policy text,
      ADD COLUMN deck_submission_due_at timestamptz,
      ADD COLUMN deck_policy_read_at timestamptz
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE playriftbound_events
      DROP COLUMN deck_submission_policy,
      DROP COLUMN deck_submission_due_at,
      DROP COLUMN deck_policy_read_at
  `.execute(db);
}
