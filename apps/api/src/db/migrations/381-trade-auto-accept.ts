import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE friend_group_members
      ADD COLUMN is_auto_accepting_offers boolean NOT NULL DEFAULT true,
      ADD COLUMN is_auto_accepting_requests boolean NOT NULL DEFAULT true
  `.execute(db);
  await sql`
    ALTER TABLE card_trades
      ADD COLUMN is_auto_accepted boolean NOT NULL DEFAULT false,
      ADD COLUMN recipient_seen_at timestamptz
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE card_trades
      DROP COLUMN recipient_seen_at,
      DROP COLUMN is_auto_accepted
  `.execute(db);
  await sql`
    ALTER TABLE friend_group_members
      DROP COLUMN is_auto_accepting_offers,
      DROP COLUMN is_auto_accepting_requests
  `.execute(db);
}
