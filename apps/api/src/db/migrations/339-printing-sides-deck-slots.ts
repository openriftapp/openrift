import type { Kysely } from "kysely";
import { sql } from "kysely";

// ADR-020: a deck slot's preferred printing must show its card, also after the printing's
// sides change, so the slot falls back to the card's default printing, merging into a slot
// that already has none. Deleting a printing folds its slots the same way before the FK nulls them.
// A side's short-code change re-sorts the printings that show it.
const UP = [
  `CREATE FUNCTION release_deck_cards_off_printing() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    UPDATE deck_cards plain SET quantity = plain.quantity + dc.quantity
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
  $fn$`,
  `CREATE TRIGGER trg_printings_release_deck_cards
    AFTER UPDATE OF face1_id, face2_id ON printings
    FOR EACH ROW
    WHEN (OLD.face1_id IS DISTINCT FROM NEW.face1_id OR OLD.face2_id IS DISTINCT FROM NEW.face2_id)
    EXECUTE FUNCTION release_deck_cards_off_printing()`,
  `CREATE FUNCTION fold_deck_cards_off_deleted_printing() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    UPDATE deck_cards plain SET quantity = plain.quantity + dc.quantity
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
  $fn$`,
  `CREATE TRIGGER trg_printings_fold_deck_cards
    BEFORE DELETE ON printings
    FOR EACH ROW EXECUTE FUNCTION fold_deck_cards_off_deleted_printing()`,
  `CREATE FUNCTION resort_printings_on_face_code() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    UPDATE printings SET face1_id = face1_id
    WHERE face2_id IS NOT NULL AND NEW.id IN (face1_id, face2_id);
    RETURN NULL;
  END
  $fn$`,
  `CREATE TRIGGER trg_faces_resort_printings
    AFTER UPDATE OF short_code ON faces
    FOR EACH ROW
    WHEN (OLD.short_code IS DISTINCT FROM NEW.short_code)
    EXECUTE FUNCTION resort_printings_on_face_code()`,
];

const DOWN = [
  `DROP TRIGGER trg_faces_resort_printings ON faces`,
  `DROP FUNCTION resort_printings_on_face_code()`,
  `DROP TRIGGER trg_printings_fold_deck_cards ON printings`,
  `DROP FUNCTION fold_deck_cards_off_deleted_printing()`,
  `DROP TRIGGER trg_printings_release_deck_cards ON printings`,
  `DROP FUNCTION release_deck_cards_off_printing()`,
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
