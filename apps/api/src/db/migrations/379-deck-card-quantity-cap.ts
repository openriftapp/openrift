import type { Kysely } from "kysely";
import { sql } from "kysely";

/** A deck card row holds at most 99 copies; the printing triggers that fold a pinned slot stop their sum there. */
function releaseOffPrinting(sum: string): string {
  return `CREATE OR REPLACE FUNCTION release_deck_cards_off_printing() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    UPDATE deck_cards plain SET quantity = ${sum}
    FROM deck_cards dc
    WHERE dc.preferred_printing_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM faces f WHERE f.id IN (NEW.face1_id, NEW.face2_id) AND f.card_id = dc.card_id
      )
      AND plain.deck_id = dc.deck_id AND plain.card_id = dc.card_id AND plain.zone = dc.zone
      AND plain.preferred_printing_id IS NULL;
    DELETE FROM deck_cards dc
    WHERE dc.preferred_printing_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM faces f WHERE f.id IN (NEW.face1_id, NEW.face2_id) AND f.card_id = dc.card_id
      )
      AND EXISTS (
        SELECT 1 FROM deck_cards plain
        WHERE plain.deck_id = dc.deck_id AND plain.card_id = dc.card_id AND plain.zone = dc.zone
          AND plain.preferred_printing_id IS NULL
      );
    UPDATE deck_cards dc SET preferred_printing_id = NULL
    WHERE dc.preferred_printing_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM faces f WHERE f.id IN (NEW.face1_id, NEW.face2_id) AND f.card_id = dc.card_id
      );
    RETURN NULL;
  END
  $fn$`;
}

function foldOffDeletedPrinting(sum: string): string {
  return `CREATE OR REPLACE FUNCTION fold_deck_cards_off_deleted_printing() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    UPDATE deck_cards plain SET quantity = ${sum}
    FROM deck_cards dc
    WHERE dc.preferred_printing_id = OLD.id
      AND plain.deck_id = dc.deck_id AND plain.card_id = dc.card_id AND plain.zone = dc.zone
      AND plain.preferred_printing_id IS NULL;
    DELETE FROM deck_cards dc
    WHERE dc.preferred_printing_id = OLD.id
      AND EXISTS (
        SELECT 1 FROM deck_cards plain
        WHERE plain.deck_id = dc.deck_id AND plain.card_id = dc.card_id AND plain.zone = dc.zone
          AND plain.preferred_printing_id IS NULL
      );
    UPDATE deck_cards SET preferred_printing_id = NULL WHERE preferred_printing_id = OLD.id;
    RETURN OLD;
  END
  $fn$`;
}

const CAPPED_SUM = "LEAST(plain.quantity + dc.quantity, 99)";
const PLAIN_SUM = "plain.quantity + dc.quantity";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql.raw(releaseOffPrinting(CAPPED_SUM)).execute(db);
  await sql.raw(foldOffDeletedPrinting(CAPPED_SUM)).execute(db);
  await sql`
    ALTER TABLE deck_cards
      ADD CONSTRAINT chk_deck_cards_quantity_max CHECK (quantity <= 99) NOT VALID
  `.execute(db);
  await sql`ALTER TABLE deck_cards VALIDATE CONSTRAINT chk_deck_cards_quantity_max`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE deck_cards DROP CONSTRAINT chk_deck_cards_quantity_max`.execute(db);
  await sql.raw(foldOffDeletedPrinting(PLAIN_SUM)).execute(db);
  await sql.raw(releaseOffPrinting(PLAIN_SUM)).execute(db);
}
