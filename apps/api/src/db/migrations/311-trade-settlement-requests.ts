import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE card_trade_settlement_requests (
      trade_id uuid NOT NULL REFERENCES card_trades(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_id uuid NOT NULL,
      fingerprint text NOT NULL,
      settled_trade_id uuid NOT NULL REFERENCES card_trades(id) ON DELETE CASCADE,
      PRIMARY KEY (trade_id, user_id, request_id)
    )
  `.execute(db);

  await sql`
    CREATE INDEX idx_card_trade_settlement_requests_user
      ON card_trade_settlement_requests(user_id)
  `.execute(db);

  await sql`
    CREATE INDEX idx_card_trade_settlement_requests_settled_trade
      ON card_trade_settlement_requests(settled_trade_id)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE card_trade_settlement_requests`.execute(db);
}
