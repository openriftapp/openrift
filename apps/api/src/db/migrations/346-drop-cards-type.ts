import type { Kysely } from "kysely";
import { sql } from "kysely";

const UP = [
  `DROP TRIGGER cards_seed_card_types ON cards`,
  `DROP FUNCTION trg_cards_seed_card_types()`,
  `CREATE OR REPLACE FUNCTION trg_card_card_types_sync() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      affected_card_id uuid;
    BEGIN
      affected_card_id := COALESCE(NEW.card_id, OLD.card_id);

      -- Card deleted in the same transaction (ON DELETE CASCADE): nothing to check.
      IF NOT EXISTS (SELECT 1 FROM cards WHERE id = affected_card_id) THEN
        RETURN NULL;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM card_card_types WHERE card_id = affected_card_id) THEN
        RAISE EXCEPTION 'card % must keep at least one card_card_types row (ADR-037)',
          affected_card_id;
      END IF;

      RETURN NULL;
    END;
    $$`,
  `CREATE FUNCTION trg_cards_require_card_types() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM cards WHERE id = NEW.id)
         AND NOT EXISTS (SELECT 1 FROM card_card_types WHERE card_id = NEW.id) THEN
        RAISE EXCEPTION 'card % must have at least one card_card_types row (ADR-037)', NEW.id;
      END IF;
      RETURN NULL;
    END;
    $$`,
  `CREATE CONSTRAINT TRIGGER cards_require_card_types AFTER INSERT ON cards
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trg_cards_require_card_types()`,
  `ALTER TABLE cards DROP COLUMN type`,
];

const DOWN = [
  `ALTER TABLE cards ADD COLUMN type text`,
  `UPDATE cards c SET type = (
     SELECT cct.type_slug FROM card_card_types cct
      WHERE cct.card_id = c.id ORDER BY cct.position LIMIT 1
   )`,
  `ALTER TABLE cards ALTER COLUMN type SET NOT NULL`,
  `ALTER TABLE cards ADD CONSTRAINT fk_cards_type FOREIGN KEY (type) REFERENCES card_types(slug)`,
  `DROP TRIGGER cards_require_card_types ON cards`,
  `DROP FUNCTION trg_cards_require_card_types()`,
  `CREATE OR REPLACE FUNCTION trg_card_card_types_sync() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      affected_card_id uuid;
      primary_slug text;
    BEGIN
      affected_card_id := COALESCE(NEW.card_id, OLD.card_id);

      IF NOT EXISTS (SELECT 1 FROM cards WHERE id = affected_card_id) THEN
        RETURN NULL;
      END IF;

      SELECT type_slug INTO primary_slug
      FROM card_card_types
      WHERE card_id = affected_card_id
      ORDER BY position
      LIMIT 1;

      IF primary_slug IS NULL THEN
        RAISE EXCEPTION 'card % must keep at least one card_card_types row (ADR-037)',
          affected_card_id;
      END IF;

      UPDATE cards SET type = primary_slug
      WHERE id = affected_card_id AND type IS DISTINCT FROM primary_slug;

      RETURN NULL;
    END;
    $$`,
  `CREATE FUNCTION trg_cards_seed_card_types() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM card_card_types WHERE card_id = NEW.id) THEN
        INSERT INTO card_card_types (card_id, type_slug, position)
        VALUES (NEW.id, NEW.type, 0);
      END IF;
      RETURN NULL;
    END;
    $$`,
  `CREATE CONSTRAINT TRIGGER cards_seed_card_types AFTER INSERT ON cards
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trg_cards_seed_card_types()`,
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
