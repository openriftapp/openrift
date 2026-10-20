import type { Kysely } from "kysely";
import { sql } from "kysely";

// ADR-020: a trade names the card it was asked for, which a double-sided printing can't tell
// once the receiver's wish entry is gone or never existed (a rule wish). An insert without a
// card takes the wish entry's card, else side 1's.
const UP = [
  `ALTER TABLE card_trades ADD COLUMN card_id uuid REFERENCES cards(id)`,
  `CREATE FUNCTION card_trades_card() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    IF NEW.card_id IS NULL THEN
      NEW.card_id := coalesce(
        (
          SELECT le.card_id FROM list_entries le
          JOIN printings p ON p.id = NEW.printing_id
          JOIN faces wf ON wf.card_id = le.card_id AND wf.id IN (p.face1_id, p.face2_id)
          WHERE le.id = NEW.receiver_wish_entry_id
          LIMIT 1
        ),
        (SELECT f.card_id FROM printings p JOIN faces f ON f.id = p.face1_id WHERE p.id = NEW.printing_id)
      );
    ELSIF NOT EXISTS (
      SELECT 1 FROM printings p JOIN faces f ON f.id IN (p.face1_id, p.face2_id)
      WHERE p.id = NEW.printing_id AND f.card_id = NEW.card_id
    ) THEN
      RAISE EXCEPTION 'card % is not on printing %', NEW.card_id, NEW.printing_id;
    END IF;
    RETURN NEW;
  END;
  $fn$`,
  `CREATE TRIGGER trg_card_trades_card
    BEFORE INSERT OR UPDATE OF card_id, printing_id ON card_trades
    FOR EACH ROW EXECUTE FUNCTION card_trades_card()`,
  `UPDATE card_trades SET card_id = NULL`,
  `ALTER TABLE card_trades ALTER COLUMN card_id SET NOT NULL`,
];

const DOWN = [
  `DROP TRIGGER trg_card_trades_card ON card_trades`,
  `DROP FUNCTION card_trades_card()`,
  `ALTER TABLE card_trades DROP COLUMN card_id`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of UP) {
    await sql.raw(statement).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const statement of DOWN) {
    await sql.raw(statement).execute(db);
  }
}
