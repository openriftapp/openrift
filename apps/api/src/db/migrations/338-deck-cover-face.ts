import type { Kysely } from "kysely";
import { sql } from "kysely";

// ADR-020: a printing shows two different faces, a deck cover names the face it shows, a deck
// slot's preferred printing shows its card, and a printing's slug follows its faces.
const UP = [
  `ALTER TABLE printings
    ADD CONSTRAINT chk_printings_distinct_faces CHECK (face2_id IS NULL OR face2_id <> face1_id)`,
  `ALTER TABLE faces ADD CONSTRAINT uq_faces_id_card UNIQUE (id, card_id)`,

  `ALTER TABLE decks ADD COLUMN cover_face_id uuid`,
  `UPDATE decks d SET cover_face_id = (
     SELECT f.id FROM printings p
     JOIN faces f ON f.id IN (p.face1_id, p.face2_id)
     WHERE p.id = d.cover_printing_id AND (d.cover_card_id IS NULL OR f.card_id = d.cover_card_id)
     ORDER BY f.id = p.face1_id DESC
     LIMIT 1
   )
   WHERE d.cover_printing_id IS NOT NULL`,
  `UPDATE decks d SET cover_card_id = f.card_id
   FROM faces f
   WHERE f.id = d.cover_face_id AND d.cover_card_id IS NULL`,
  `ALTER TABLE decks
    ADD CONSTRAINT decks_cover_face_id_fkey FOREIGN KEY (cover_face_id) REFERENCES faces(id) ON DELETE SET NULL`,
  `ALTER TABLE decks
    ADD CONSTRAINT fk_decks_cover_face_card FOREIGN KEY (cover_face_id, cover_card_id) REFERENCES faces(id, card_id)`,
  `ALTER TABLE decks DROP COLUMN cover_printing_id`,

  `CREATE FUNCTION check_deck_card_printing() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    IF NEW.preferred_printing_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM printings p
      JOIN faces f ON f.id IN (p.face1_id, p.face2_id)
      WHERE p.id = NEW.preferred_printing_id AND f.card_id = NEW.card_id
    ) THEN
      RAISE EXCEPTION 'printing % does not show card %', NEW.preferred_printing_id, NEW.card_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
  END
  $fn$`,
  `CREATE TRIGGER trg_deck_cards_printing_card
    BEFORE INSERT OR UPDATE OF card_id, preferred_printing_id ON deck_cards
    FOR EACH ROW EXECUTE FUNCTION check_deck_card_printing()`,

  `CREATE OR REPLACE FUNCTION trg_printings_set_slug() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      f1 faces%ROWTYPE;
      f2 faces%ROWTYPE;
      physical_finish text;
      markers text[];
      base text;
      candidate text;
      n int := 1;
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF NEW.face1_id IS NOT DISTINCT FROM OLD.face1_id
           AND NEW.face2_id IS NOT DISTINCT FROM OLD.face2_id THEN
          RETURN NEW;
        END IF;
      ELSIF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
        RETURN NEW;
      END IF;
      SELECT * INTO f1 FROM faces WHERE id = NEW.face1_id;
      IF NEW.face2_id IS NOT NULL THEN
        SELECT * INTO f2 FROM faces WHERE id = NEW.face2_id;
      END IF;
      physical_finish := CASE WHEN f2.finish = 'foil' THEN 'foil' ELSE f1.finish END;
      markers := ARRAY(SELECT DISTINCT unnest(f1.marker_slugs || COALESCE(f2.marker_slugs, '{}')) ORDER BY 1);
      base := trim(BOTH '-' FROM regexp_replace(
        lower(
          coalesce(f1.language, '') || '-' ||
          coalesce(f1.short_code, '') || '-' ||
          coalesce(f2.short_code || '-', '') ||
          coalesce(physical_finish, '') || '-' ||
          array_to_string(markers, '-') || '-' ||
          coalesce(NEW.size, '')
        ),
        '[^a-z0-9]+', '-', 'g'
      ));
      IF base = '' THEN
        base := 'printing';
      END IF;
      candidate := base;
      WHILE EXISTS (SELECT 1 FROM printings WHERE slug = candidate AND id <> NEW.id) LOOP
        n := n + 1;
        candidate := base || '-' || n;
      END LOOP;
      NEW.slug := candidate;
      RETURN NEW;
    END;
    $$`,
  `DROP TRIGGER printings_set_slug ON printings`,
  `CREATE TRIGGER printings_set_slug BEFORE INSERT OR UPDATE OF face1_id, face2_id ON printings
    FOR EACH ROW EXECUTE FUNCTION trg_printings_set_slug()`,
];

const DOWN = [
  `DROP TRIGGER printings_set_slug ON printings`,
  `CREATE OR REPLACE FUNCTION trg_printings_set_slug() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      f1 faces%ROWTYPE;
      f2 faces%ROWTYPE;
      physical_finish text;
      markers text[];
      base text;
      candidate text;
      n int := 1;
    BEGIN
      IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
        RETURN NEW;
      END IF;
      SELECT * INTO f1 FROM faces WHERE id = NEW.face1_id;
      IF NEW.face2_id IS NOT NULL THEN
        SELECT * INTO f2 FROM faces WHERE id = NEW.face2_id;
      END IF;
      physical_finish := CASE WHEN f2.finish = 'foil' THEN 'foil' ELSE f1.finish END;
      markers := ARRAY(SELECT DISTINCT unnest(f1.marker_slugs || COALESCE(f2.marker_slugs, '{}')) ORDER BY 1);
      base := trim(BOTH '-' FROM regexp_replace(
        lower(
          coalesce(f1.language, '') || '-' ||
          coalesce(f1.short_code, '') || '-' ||
          coalesce(f2.short_code || '-', '') ||
          coalesce(physical_finish, '') || '-' ||
          array_to_string(markers, '-') || '-' ||
          coalesce(NEW.size, '')
        ),
        '[^a-z0-9]+', '-', 'g'
      ));
      IF base = '' THEN
        base := 'printing';
      END IF;
      candidate := base;
      WHILE EXISTS (SELECT 1 FROM printings WHERE slug = candidate) LOOP
        n := n + 1;
        candidate := base || '-' || n;
      END LOOP;
      NEW.slug := candidate;
      RETURN NEW;
    END;
    $$`,
  `CREATE TRIGGER printings_set_slug BEFORE INSERT ON printings FOR EACH ROW EXECUTE FUNCTION trg_printings_set_slug()`,

  `DROP TRIGGER trg_deck_cards_printing_card ON deck_cards`,
  `DROP FUNCTION check_deck_card_printing()`,

  `ALTER TABLE decks ADD COLUMN cover_printing_id uuid`,
  `UPDATE decks d SET cover_printing_id = (
     SELECT p.id FROM printings p
     WHERE d.cover_face_id IN (p.face1_id, p.face2_id)
     ORDER BY d.cover_face_id = p.face1_id DESC, p.id
     LIMIT 1
   )
   WHERE d.cover_face_id IS NOT NULL`,
  `ALTER TABLE decks
    ADD CONSTRAINT decks_cover_printing_id_fkey FOREIGN KEY (cover_printing_id) REFERENCES printings(id) ON DELETE SET NULL`,
  `ALTER TABLE decks DROP COLUMN cover_face_id`,
  `ALTER TABLE faces DROP CONSTRAINT uq_faces_id_card`,
  `ALTER TABLE printings DROP CONSTRAINT chk_printings_distinct_faces`,
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
