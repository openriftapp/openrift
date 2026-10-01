import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE card_trade_requested_copies (
      trade_id uuid NOT NULL REFERENCES card_trades(id) ON DELETE CASCADE,
      copy_id uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
      PRIMARY KEY (trade_id, copy_id)
    )
  `.execute(db);
  await sql`
    CREATE INDEX idx_card_trade_requested_copies_copy ON card_trade_requested_copies (copy_id)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS card_trade_requested_copies`.execute(db);
}
