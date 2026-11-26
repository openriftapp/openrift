import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX uq_deck_cards_zone ON deck_cards
      (deck_id, zone, card_id, preferred_printing_id) NULLS NOT DISTINCT
  `.execute(db);
  await sql`DROP INDEX uq_deck_cards`.execute(db);
  await sql`ALTER INDEX uq_deck_cards_zone RENAME TO uq_deck_cards`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX uq_deck_cards_card ON deck_cards
      (deck_id, card_id, zone, preferred_printing_id) NULLS NOT DISTINCT
  `.execute(db);
  await sql`DROP INDEX uq_deck_cards`.execute(db);
  await sql`ALTER INDEX uq_deck_cards_card RENAME TO uq_deck_cards`.execute(db);
}
