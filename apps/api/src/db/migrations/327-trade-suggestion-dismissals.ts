import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE trade_suggestion_dismissals (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      counterparty_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      printing_id uuid NOT NULL REFERENCES printings(id) ON DELETE CASCADE,
      direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_trade_suggestion_dismissals
        UNIQUE (user_id, counterparty_user_id, printing_id, direction)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS trade_suggestion_dismissals`.execute(db);
}
