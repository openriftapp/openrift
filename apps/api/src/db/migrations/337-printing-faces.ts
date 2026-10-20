import type { Kysely } from "kysely";
import { sql } from "kysely";

// ADR-020: printed sides move from printings to shared faces. Every existing printing gets
// face1; printings that share every printed attribute (standard and oversized) share it.
const UP = [
  // Aborts when a printed identity groups printings that disagree on another printed column,
  // so the backfill never silently picks one printing's values for a shared face.
  `DO $check$ BEGIN
    IF (SELECT count(*) FROM (SELECT 1 FROM printings GROUP BY card_id, short_code, finish, marker_slugs, language) x)
       <> (SELECT count(*) FROM (SELECT 1 FROM printings GROUP BY card_id, set_id, short_code, public_code, art_variant,
             artist, printed_name, printed_rules_text, printed_effect_text, flavor_text, language, rarity, printed_year,
             finish, is_signed, is_overnumbered, marker_slugs, fallback_art_mode, fallback_image_file_id) x) THEN
      RAISE EXCEPTION 'printings sharing a printed identity differ in other printed columns';
    END IF;
  END $check$`,

  `CREATE TABLE faces (
    id uuid DEFAULT uuidv7() NOT NULL,
    card_id uuid NOT NULL,
    set_id uuid NOT NULL,
    short_code text NOT NULL,
    public_code text NOT NULL,
    art_variant text NOT NULL,
    artist text NOT NULL,
    printed_name text,
    printed_rules_text text,
    printed_effect_text text,
    flavor_text text,
    language text DEFAULT 'EN'::text NOT NULL,
    rarity text NOT NULL,
    printed_year smallint,
    finish text NOT NULL,
    is_signed boolean DEFAULT false NOT NULL,
    is_overnumbered boolean DEFAULT false NOT NULL,
    marker_slugs text[] DEFAULT '{}'::text[] NOT NULL,
    fallback_art_mode text DEFAULT 'auto'::text NOT NULL,
    fallback_image_file_id uuid,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT faces_pkey PRIMARY KEY (id),
    CONSTRAINT uq_faces_identity UNIQUE NULLS NOT DISTINCT (card_id, short_code, finish, marker_slugs, language)
      DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT uq_faces_variant UNIQUE (short_code, art_variant, is_signed, is_overnumbered, marker_slugs, rarity, finish, language)
      DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT faces_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id),
    CONSTRAINT faces_set_id_fkey FOREIGN KEY (set_id) REFERENCES sets(id),
    CONSTRAINT faces_language_fk FOREIGN KEY (language) REFERENCES languages(code) ON UPDATE CASCADE,
    CONSTRAINT fk_faces_art_variant FOREIGN KEY (art_variant) REFERENCES art_variants(slug),
    CONSTRAINT fk_faces_finish FOREIGN KEY (finish) REFERENCES finishes(slug),
    CONSTRAINT fk_faces_rarity FOREIGN KEY (rarity) REFERENCES rarities(slug),
    CONSTRAINT fk_faces_fallback_image_file FOREIGN KEY (fallback_image_file_id) REFERENCES image_files(id) ON DELETE RESTRICT,
    CONSTRAINT chk_faces_short_code_not_empty CHECK (short_code <> ''),
    CONSTRAINT chk_faces_public_code_not_empty CHECK (public_code <> ''),
    CONSTRAINT chk_faces_artist_not_empty CHECK (artist <> ''),
    CONSTRAINT chk_faces_no_empty_printed_name CHECK (printed_name <> ''),
    CONSTRAINT chk_faces_no_empty_printed_rules_text CHECK (printed_rules_text <> ''),
    CONSTRAINT chk_faces_no_empty_printed_effect_text CHECK (printed_effect_text <> ''),
    CONSTRAINT chk_faces_no_empty_flavor_text CHECK (flavor_text <> ''),
    CONSTRAINT chk_faces_no_empty_comment CHECK (comment <> ''),
    CONSTRAINT chk_faces_fallback_art_mode CHECK (fallback_art_mode = ANY (ARRAY['auto', 'pinned', 'none'])),
    CONSTRAINT chk_faces_fallback_pinned_has_image CHECK ((fallback_art_mode = 'pinned') = (fallback_image_file_id IS NOT NULL))
  )`,
  `CREATE INDEX idx_faces_card_id ON faces USING btree (card_id)`,
  `CREATE INDEX idx_faces_set_id ON faces USING btree (set_id)`,
  `CREATE INDEX idx_faces_marker_slugs ON faces USING gin (marker_slugs)`,
  `CREATE INDEX idx_faces_fallback_image_file ON faces USING btree (fallback_image_file_id) WHERE (fallback_image_file_id IS NOT NULL)`,
  `CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON faces FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,

  // The representative printing of each printed identity lends its id to the shared face.
  `CREATE TEMP TABLE printing_face_map AS
    SELECT p.id AS printing_id,
      first_value(p.id) OVER (
        PARTITION BY p.card_id, p.short_code, p.finish, p.marker_slugs, p.language
        ORDER BY (p.size = 'standard') DESC, p.created_at, p.id
      ) AS face_id
    FROM printings p`,
  `INSERT INTO faces (id, card_id, set_id, short_code, public_code, art_variant, artist, printed_name,
      printed_rules_text, printed_effect_text, flavor_text, language, rarity, printed_year, finish, is_signed,
      is_overnumbered, marker_slugs, fallback_art_mode, fallback_image_file_id, created_at, updated_at)
    SELECT p.id, p.card_id, p.set_id, p.short_code, p.public_code, p.art_variant, p.artist, p.printed_name,
      p.printed_rules_text, p.printed_effect_text, p.flavor_text, p.language, p.rarity, p.printed_year, p.finish,
      p.is_signed, p.is_overnumbered, p.marker_slugs, p.fallback_art_mode, p.fallback_image_file_id, p.created_at,
      p.updated_at
    FROM printings p
    WHERE p.id IN (SELECT DISTINCT face_id FROM printing_face_map)`,

  `CREATE TABLE face_images (
    id uuid DEFAULT uuidv7() NOT NULL,
    face_id uuid NOT NULL,
    image_file_id uuid NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT face_images_pkey PRIMARY KEY (id),
    CONSTRAINT face_images_face_id_fkey FOREIGN KEY (face_id) REFERENCES faces(id),
    CONSTRAINT fk_face_images_image_file FOREIGN KEY (image_file_id) REFERENCES image_files(id)
  )`,
  `INSERT INTO face_images (id, face_id, image_file_id, is_active, created_at, updated_at)
    SELECT DISTINCT ON (m.face_id, pi.image_file_id) pi.id, m.face_id, pi.image_file_id,
      bool_or(pi.is_active) OVER (PARTITION BY m.face_id, pi.image_file_id), pi.created_at, pi.updated_at
    FROM printing_images pi
    JOIN printing_face_map m ON m.printing_id = pi.printing_id
    ORDER BY m.face_id, pi.image_file_id, (pi.printing_id = m.face_id) DESC, pi.created_at, pi.id`,
  // Printings that now share a face may each have had their own active image; the oldest stays.
  `UPDATE face_images fi SET is_active = false
    WHERE fi.is_active AND EXISTS (
      SELECT 1 FROM face_images o
      WHERE o.face_id = fi.face_id AND o.is_active AND (o.created_at, o.id) < (fi.created_at, fi.id)
    )`,
  `CREATE UNIQUE INDEX idx_face_images_active ON face_images USING btree (face_id) WHERE (is_active = true)`,
  `CREATE INDEX idx_face_images_face ON face_images USING btree (face_id)`,
  `CREATE INDEX idx_face_images_image_file ON face_images USING btree (image_file_id)`,
  `CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON face_images FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,

  // Markers live only in faces.marker_slugs; triggers take over the join table's integrity.
  `CREATE FUNCTION trg_faces_normalize_markers() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      unknown_slug text;
    BEGIN
      NEW.marker_slugs := COALESCE(
        (SELECT array_agg(DISTINCT s.marker ORDER BY s.marker) FROM unnest(NEW.marker_slugs) AS s(marker)),
        '{}'::text[]
      );
      SELECT s.marker INTO unknown_slug FROM unnest(NEW.marker_slugs) AS s(marker)
        WHERE NOT EXISTS (SELECT 1 FROM markers m WHERE m.slug = s.marker) LIMIT 1;
      IF unknown_slug IS NOT NULL THEN
        RAISE EXCEPTION 'unknown marker %', unknown_slug;
      END IF;
      RETURN NEW;
    END;
    $$`,
  `CREATE TRIGGER faces_normalize_markers BEFORE INSERT OR UPDATE OF marker_slugs ON faces
    FOR EACH ROW EXECUTE FUNCTION trg_faces_normalize_markers()`,
  `CREATE FUNCTION trg_markers_guard_delete() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM faces WHERE marker_slugs @> ARRAY[OLD.slug]) THEN
        RAISE EXCEPTION 'marker % is still used by a face', OLD.slug;
      END IF;
      RETURN OLD;
    END;
    $$`,
  `CREATE TRIGGER markers_guard_delete BEFORE DELETE ON markers FOR EACH ROW EXECUTE FUNCTION trg_markers_guard_delete()`,
  `DROP TRIGGER markers_slug_change ON markers`,
  `DROP FUNCTION trg_markers_slug_change()`,
  `CREATE FUNCTION trg_markers_slug_change() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.slug IS DISTINCT FROM OLD.slug THEN
        UPDATE faces SET marker_slugs = array_replace(marker_slugs, OLD.slug, NEW.slug)
          WHERE marker_slugs @> ARRAY[OLD.slug];
      END IF;
      RETURN NEW;
    END;
    $$`,
  `CREATE TRIGGER markers_slug_change AFTER UPDATE OF slug ON markers FOR EACH ROW EXECUTE FUNCTION trg_markers_slug_change()`,

  // Everything that reads the moved printing columns goes before the columns do.
  `DROP VIEW printings_ordered`,
  `DROP MATERIALIZED VIEW mv_printing_foil_twins`,
  `DROP MATERIALIZED VIEW mv_printings_canonical_rank`,
  `DROP TRIGGER printings_set_slug ON printings`,
  `DROP FUNCTION trg_printings_set_slug()`,
  `DROP TABLE printing_markers`,
  `DROP FUNCTION trg_printing_markers_sync()`,
  `DROP FUNCTION recompute_printing_marker_slugs(uuid)`,

  `ALTER TABLE printings
    ADD COLUMN face1_id uuid,
    ADD COLUMN face2_id uuid`,
  `UPDATE printings p SET face1_id = m.face_id FROM printing_face_map m WHERE m.printing_id = p.id`,

  `ALTER TABLE decks DROP CONSTRAINT fk_decks_cover_printing_card`,
  `ALTER TABLE deck_check_entry_cards DROP CONSTRAINT fk_deck_check_entry_cards_printing_card`,
  `ALTER TABLE deck_check_entry_cards DROP COLUMN resolved_printing_id`,
  `ALTER TABLE deck_cards DROP CONSTRAINT fk_deck_cards_printing_card`,
  `ALTER TABLE card_trades DROP CONSTRAINT fk_card_trades_printing_card`,
  `ALTER TABLE card_trades DROP COLUMN card_id`,
  `ALTER TABLE loans DROP CONSTRAINT fk_loans_printing_card`,
  `ALTER TABLE loans DROP COLUMN card_id`,

  `DROP TABLE printing_images`,
  `DROP INDEX uq_printings_card_slug`,
  `ALTER TABLE printings
    DROP CONSTRAINT uq_printings_id_card,
    DROP CONSTRAINT uq_printings_identity,
    DROP CONSTRAINT uq_printings_variant,
    DROP COLUMN card_id,
    DROP COLUMN set_id,
    DROP COLUMN short_code,
    DROP COLUMN public_code,
    DROP COLUMN art_variant,
    DROP COLUMN artist,
    DROP COLUMN printed_name,
    DROP COLUMN printed_rules_text,
    DROP COLUMN printed_effect_text,
    DROP COLUMN flavor_text,
    DROP COLUMN language,
    DROP COLUMN rarity,
    DROP COLUMN printed_year,
    DROP COLUMN finish,
    DROP COLUMN is_signed,
    DROP COLUMN is_overnumbered,
    DROP COLUMN marker_slugs,
    DROP COLUMN fallback_art_mode,
    DROP COLUMN fallback_image_file_id`,
  `ALTER TABLE printings
    ALTER COLUMN face1_id SET NOT NULL,
    ADD CONSTRAINT printings_face1_id_fkey FOREIGN KEY (face1_id) REFERENCES faces(id),
    ADD CONSTRAINT printings_face2_id_fkey FOREIGN KEY (face2_id) REFERENCES faces(id),
    ADD CONSTRAINT uq_printings_slug UNIQUE (slug),
    ADD CONSTRAINT uq_printings_identity UNIQUE NULLS NOT DISTINCT (face1_id, face2_id, size)
      DEFERRABLE INITIALLY DEFERRED`,
  `CREATE INDEX idx_printings_face1 ON printings USING btree (face1_id)`,
  `CREATE INDEX idx_printings_face2 ON printings USING btree (face2_id) WHERE (face2_id IS NOT NULL)`,

  // Display order only: face1 is the side whose collector code sorts first.
  `CREATE FUNCTION trg_printings_order_faces() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      code_1 text;
      code_2 text;
      swap uuid;
    BEGIN
      IF NEW.face2_id IS NULL THEN
        RETURN NEW;
      END IF;
      SELECT short_code INTO code_1 FROM faces WHERE id = NEW.face1_id;
      SELECT short_code INTO code_2 FROM faces WHERE id = NEW.face2_id;
      IF code_2 < code_1 OR (code_2 = code_1 AND NEW.face2_id < NEW.face1_id) THEN
        swap := NEW.face1_id;
        NEW.face1_id := NEW.face2_id;
        NEW.face2_id := swap;
      END IF;
      RETURN NEW;
    END;
    $$`,
  `CREATE TRIGGER printings_order_faces BEFORE INSERT OR UPDATE OF face1_id, face2_id ON printings
    FOR EACH ROW EXECUTE FUNCTION trg_printings_order_faces()`,

  `CREATE FUNCTION trg_printings_set_slug() RETURNS trigger
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

  // A printing has a foil twin when a foil printing of the same size carries the same sides
  // in every other identity attribute.
  `CREATE MATERIALIZED VIEW mv_printing_foil_twins AS
    SELECT p.id AS printing_id
    FROM printings p
    JOIN faces a1 ON a1.id = p.face1_id
    LEFT JOIN faces a2 ON a2.id = p.face2_id
    WHERE a1.finish <> 'foil' AND COALESCE(a2.finish, '') <> 'foil'
      AND EXISTS (
        SELECT 1
        FROM printings q
        JOIN faces b1 ON b1.id = q.face1_id
        LEFT JOIN faces b2 ON b2.id = q.face2_id
        WHERE q.size = p.size
          AND (b1.finish = 'foil' OR b2.finish = 'foil')
          AND b1.card_id = a1.card_id AND b1.short_code = a1.short_code AND b1.language = a1.language
          AND b1.art_variant = a1.art_variant AND b1.is_signed = a1.is_signed
          AND b1.is_overnumbered = a1.is_overnumbered AND b1.marker_slugs = a1.marker_slugs
          AND (b2.id IS NULL) = (a2.id IS NULL)
          AND (a2.id IS NULL OR (b2.card_id = a2.card_id AND b2.short_code = a2.short_code
            AND b2.language = a2.language AND b2.art_variant = a2.art_variant AND b2.is_signed = a2.is_signed
            AND b2.is_overnumbered = a2.is_overnumbered AND b2.marker_slugs = a2.marker_slugs))
      )`,
  `CREATE UNIQUE INDEX idx_mv_printing_foil_twins_pk ON mv_printing_foil_twins USING btree (printing_id)`,

  // One rank per printing side, sorted by that side's printed attributes.
  `CREATE MATERIALIZED VIEW mv_printing_sides_canonical_rank AS
    SELECT s.printing_id, s.position,
      (row_number() OVER (ORDER BY l.sort_order, st.sort_order, f.short_code,
        (array_length(f.marker_slugs, 1) IS NOT NULL),
        COALESCE((SELECT min(m.sort_order) FROM markers m WHERE m.slug = ANY (f.marker_slugs)), 0),
        fi.sort_order, cs.sort_order, s.position))::integer AS canonical_rank
    FROM (
      SELECT id AS printing_id, 1 AS position, face1_id AS face_id, size FROM printings
      UNION ALL
      SELECT id, 2, face2_id, size FROM printings WHERE face2_id IS NOT NULL
    ) s
    JOIN faces f ON f.id = s.face_id
    JOIN sets st ON st.id = f.set_id
    JOIN finishes fi ON fi.slug = f.finish
    JOIN card_sizes cs ON cs.slug = s.size
    JOIN languages l ON l.code = f.language`,
  `CREATE UNIQUE INDEX idx_mv_printing_sides_canonical_rank_pk ON mv_printing_sides_canonical_rank USING btree (printing_id, position)`,

  `CREATE VIEW printing_sides_ordered AS
    SELECT s.printing_id, s.position, f.id AS face_id, f.card_id, f.set_id, f.short_code, f.public_code,
      f.art_variant, f.artist, f.printed_name, f.printed_rules_text, f.printed_effect_text, f.flavor_text,
      f.language, f.rarity, f.printed_year, f.finish, f.is_signed, f.is_overnumbered, f.marker_slugs,
      f.fallback_art_mode, f.fallback_image_file_id, f.comment AS face_comment,
      p.slug, p.size, p.released_at, p.release_precision, p.announced_at, p.comment, p.created_at, p.updated_at,
      COALESCE(r.canonical_rank, 2147483647) AS canonical_rank,
      (t.printing_id IS NOT NULL) AS has_foil_twin
    FROM (
      SELECT id AS printing_id, 1 AS position, face1_id AS face_id FROM printings
      UNION ALL
      SELECT id, 2, face2_id FROM printings WHERE face2_id IS NOT NULL
    ) s
    JOIN printings p ON p.id = s.printing_id
    JOIN faces f ON f.id = s.face_id
    LEFT JOIN mv_printing_sides_canonical_rank r ON r.printing_id = s.printing_id AND r.position = s.position
    LEFT JOIN mv_printing_foil_twins t ON t.printing_id = s.printing_id`,
  `DROP TABLE printing_face_map`,
];

const DOWN = [
  `DROP VIEW printing_sides_ordered`,
  `DROP MATERIALIZED VIEW mv_printing_sides_canonical_rank`,
  `DROP MATERIALIZED VIEW mv_printing_foil_twins`,
  `DROP TRIGGER printings_set_slug ON printings`,
  `DROP FUNCTION trg_printings_set_slug()`,
  `DROP TRIGGER printings_order_faces ON printings`,
  `DROP FUNCTION trg_printings_order_faces()`,
  `DO $check$ BEGIN
    IF EXISTS (SELECT 1 FROM printings WHERE face2_id IS NOT NULL) THEN
      RAISE EXCEPTION 'double-sided printings exist; they cannot be represented without faces';
    END IF;
  END $check$`,

  `ALTER TABLE printings
    ADD COLUMN card_id uuid,
    ADD COLUMN set_id uuid,
    ADD COLUMN short_code text,
    ADD COLUMN public_code text,
    ADD COLUMN art_variant text,
    ADD COLUMN artist text,
    ADD COLUMN printed_name text,
    ADD COLUMN printed_rules_text text,
    ADD COLUMN printed_effect_text text,
    ADD COLUMN flavor_text text,
    ADD COLUMN language text DEFAULT 'EN'::text,
    ADD COLUMN rarity text,
    ADD COLUMN printed_year smallint,
    ADD COLUMN finish text,
    ADD COLUMN is_signed boolean DEFAULT false,
    ADD COLUMN is_overnumbered boolean DEFAULT false,
    ADD COLUMN marker_slugs text[] DEFAULT '{}'::text[],
    ADD COLUMN fallback_art_mode text DEFAULT 'auto'::text,
    ADD COLUMN fallback_image_file_id uuid`,
  `UPDATE printings p SET card_id = f.card_id, set_id = f.set_id, short_code = f.short_code,
      public_code = f.public_code, art_variant = f.art_variant, artist = f.artist, printed_name = f.printed_name,
      printed_rules_text = f.printed_rules_text, printed_effect_text = f.printed_effect_text,
      flavor_text = f.flavor_text, language = f.language, rarity = f.rarity, printed_year = f.printed_year,
      finish = f.finish, is_signed = f.is_signed, is_overnumbered = f.is_overnumbered,
      marker_slugs = f.marker_slugs, fallback_art_mode = f.fallback_art_mode,
      fallback_image_file_id = f.fallback_image_file_id
    FROM faces f WHERE f.id = p.face1_id`,
  `UPDATE printings p SET comment = concat_ws(E'\n', p.comment, f.comment)
    FROM faces f WHERE f.id = p.face1_id AND f.comment IS NOT NULL`,
  `ALTER TABLE printings
    ALTER COLUMN card_id SET NOT NULL,
    ALTER COLUMN set_id SET NOT NULL,
    ALTER COLUMN short_code SET NOT NULL,
    ALTER COLUMN public_code SET NOT NULL,
    ALTER COLUMN art_variant SET NOT NULL,
    ALTER COLUMN artist SET NOT NULL,
    ALTER COLUMN language SET NOT NULL,
    ALTER COLUMN rarity SET NOT NULL,
    ALTER COLUMN finish SET NOT NULL,
    ALTER COLUMN is_signed SET NOT NULL,
    ALTER COLUMN is_overnumbered SET NOT NULL,
    ALTER COLUMN marker_slugs SET NOT NULL,
    ALTER COLUMN fallback_art_mode SET NOT NULL,
    DROP CONSTRAINT uq_printings_identity,
    DROP CONSTRAINT uq_printings_slug,
    ADD CONSTRAINT uq_printings_id_card UNIQUE (id, card_id),
    ADD CONSTRAINT uq_printings_identity UNIQUE NULLS NOT DISTINCT (card_id, short_code, finish, marker_slugs, language, size)
      DEFERRABLE INITIALLY DEFERRED,
    ADD CONSTRAINT uq_printings_variant UNIQUE (short_code, art_variant, is_signed, is_overnumbered, marker_slugs, rarity, finish, language, size)
      DEFERRABLE INITIALLY DEFERRED,
    ADD CONSTRAINT printings_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id),
    ADD CONSTRAINT printings_set_id_fkey FOREIGN KEY (set_id) REFERENCES sets(id),
    ADD CONSTRAINT printings_language_fk FOREIGN KEY (language) REFERENCES languages(code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_printings_art_variant FOREIGN KEY (art_variant) REFERENCES art_variants(slug),
    ADD CONSTRAINT fk_printings_finish FOREIGN KEY (finish) REFERENCES finishes(slug),
    ADD CONSTRAINT fk_printings_rarity FOREIGN KEY (rarity) REFERENCES rarities(slug),
    ADD CONSTRAINT fk_printings_fallback_image_file FOREIGN KEY (fallback_image_file_id) REFERENCES image_files(id) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_printings_short_code_not_empty CHECK (short_code <> ''),
    ADD CONSTRAINT chk_printings_public_code_not_empty CHECK (public_code <> ''),
    ADD CONSTRAINT chk_printings_artist_not_empty CHECK (artist <> ''),
    ADD CONSTRAINT chk_printings_no_empty_printed_name CHECK (printed_name <> ''),
    ADD CONSTRAINT chk_printings_no_empty_printed_rules_text CHECK (printed_rules_text <> ''),
    ADD CONSTRAINT chk_printings_no_empty_printed_effect_text CHECK (printed_effect_text <> ''),
    ADD CONSTRAINT chk_printings_no_empty_flavor_text CHECK (flavor_text <> ''),
    ADD CONSTRAINT chk_printings_fallback_art_mode CHECK (fallback_art_mode = ANY (ARRAY['auto', 'pinned', 'none'])),
    ADD CONSTRAINT chk_printings_fallback_pinned_has_image CHECK ((fallback_art_mode = 'pinned') = (fallback_image_file_id IS NOT NULL))`,
  `CREATE UNIQUE INDEX uq_printings_card_slug ON printings USING btree (card_id, slug)`,
  `CREATE INDEX idx_printings_card_id ON printings USING btree (card_id)`,
  `CREATE INDEX idx_printings_set_id ON printings USING btree (set_id)`,
  `CREATE INDEX idx_printings_marker_slugs ON printings USING gin (marker_slugs)`,
  `CREATE INDEX idx_printings_fallback_image_file ON printings USING btree (fallback_image_file_id) WHERE (fallback_image_file_id IS NOT NULL)`,

  `CREATE TABLE printing_images (
    id uuid DEFAULT uuidv7() NOT NULL,
    face text DEFAULT 'front'::text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    printing_id uuid NOT NULL,
    image_file_id uuid CONSTRAINT printing_images_card_image_id_not_null NOT NULL,
    CONSTRAINT printing_images_pkey PRIMARY KEY (id),
    CONSTRAINT chk_printing_images_face CHECK (face = ANY (ARRAY['front', 'back'])),
    CONSTRAINT printing_images_printing_id_fkey FOREIGN KEY (printing_id) REFERENCES printings(id),
    CONSTRAINT fk_printing_images_image_file FOREIGN KEY (image_file_id) REFERENCES image_files(id)
  )`,
  `INSERT INTO printing_images (id, face, is_active, created_at, updated_at, printing_id, image_file_id)
    SELECT CASE WHEN p.id = fi.face_id THEN fi.id ELSE uuidv7() END, 'front', fi.is_active, fi.created_at,
      fi.updated_at, p.id, fi.image_file_id
    FROM face_images fi
    JOIN printings p ON p.face1_id = fi.face_id`,
  `CREATE UNIQUE INDEX idx_printing_images_active ON printing_images USING btree (printing_id, face) WHERE (is_active = true)`,
  `CREATE INDEX idx_printing_images_image_file ON printing_images USING btree (image_file_id)`,
  `CREATE INDEX idx_printing_images_printing_face ON printing_images USING btree (printing_id, face)`,
  `CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON printing_images FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,

  `ALTER TABLE loans ADD COLUMN card_id uuid`,
  `UPDATE loans l SET card_id = p.card_id FROM printings p WHERE p.id = l.printing_id`,
  `ALTER TABLE loans ALTER COLUMN card_id SET NOT NULL,
    ADD CONSTRAINT fk_loans_printing_card FOREIGN KEY (printing_id, card_id) REFERENCES printings(id, card_id)`,
  `ALTER TABLE card_trades ADD COLUMN card_id uuid`,
  `UPDATE card_trades t SET card_id = p.card_id FROM printings p WHERE p.id = t.printing_id`,
  `ALTER TABLE card_trades ALTER COLUMN card_id SET NOT NULL,
    ADD CONSTRAINT fk_card_trades_printing_card FOREIGN KEY (printing_id, card_id) REFERENCES printings(id, card_id)`,
  `ALTER TABLE deck_cards
    ADD CONSTRAINT fk_deck_cards_printing_card FOREIGN KEY (preferred_printing_id, card_id) REFERENCES printings(id, card_id)`,
  `ALTER TABLE deck_check_entry_cards
    ADD COLUMN resolved_printing_id uuid,
    ADD CONSTRAINT deck_check_entry_cards_printing_fkey FOREIGN KEY (resolved_printing_id) REFERENCES printings(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_deck_check_entry_cards_printing_card FOREIGN KEY (resolved_printing_id, resolved_card_id) REFERENCES printings(id, card_id)`,
  `ALTER TABLE decks
    ADD CONSTRAINT fk_decks_cover_printing_card FOREIGN KEY (cover_printing_id, cover_card_id) REFERENCES printings(id, card_id)`,

  `CREATE TABLE printing_markers (
    printing_id uuid NOT NULL,
    marker_id uuid NOT NULL,
    CONSTRAINT printing_markers_pkey PRIMARY KEY (printing_id, marker_id),
    CONSTRAINT printing_markers_marker_id_fkey FOREIGN KEY (marker_id) REFERENCES markers(id) ON DELETE RESTRICT,
    CONSTRAINT printing_markers_printing_id_fkey FOREIGN KEY (printing_id) REFERENCES printings(id) ON DELETE CASCADE
  )`,
  `INSERT INTO printing_markers (printing_id, marker_id)
    SELECT p.id, m.id FROM printings p JOIN markers m ON m.slug = ANY (p.marker_slugs)`,
  `CREATE INDEX idx_printing_markers_marker_id ON printing_markers USING btree (marker_id)`,
  `CREATE FUNCTION recompute_printing_marker_slugs(target_printing_id uuid) RETURNS void
    LANGUAGE sql AS $$
      UPDATE printings
      SET marker_slugs = COALESCE(
        (SELECT array_agg(m.slug ORDER BY m.slug)
         FROM printing_markers pm
         JOIN markers m ON m.id = pm.marker_id
         WHERE pm.printing_id = target_printing_id),
        '{}'::text[]
      )
      WHERE id = target_printing_id;
    $$`,
  `CREATE FUNCTION trg_printing_markers_sync() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        PERFORM recompute_printing_marker_slugs(OLD.printing_id);
        RETURN OLD;
      ELSE
        PERFORM recompute_printing_marker_slugs(NEW.printing_id);
        RETURN NEW;
      END IF;
    END;
    $$`,
  `CREATE TRIGGER printing_markers_sync_iud AFTER INSERT OR DELETE OR UPDATE ON printing_markers
    FOR EACH ROW EXECUTE FUNCTION trg_printing_markers_sync()`,
  `DROP TRIGGER markers_slug_change ON markers`,
  `DROP FUNCTION trg_markers_slug_change()`,
  `CREATE FUNCTION trg_markers_slug_change() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      affected_id uuid;
    BEGIN
      IF NEW.slug IS DISTINCT FROM OLD.slug THEN
        FOR affected_id IN SELECT printing_id FROM printing_markers WHERE marker_id = NEW.id LOOP
          PERFORM recompute_printing_marker_slugs(affected_id);
        END LOOP;
      END IF;
      RETURN NEW;
    END;
    $$`,
  `CREATE TRIGGER markers_slug_change AFTER UPDATE OF slug ON markers FOR EACH ROW EXECUTE FUNCTION trg_markers_slug_change()`,
  `DROP TRIGGER markers_guard_delete ON markers`,
  `DROP FUNCTION trg_markers_guard_delete()`,

  `CREATE FUNCTION trg_printings_set_slug() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      base text;
      candidate text;
      n int := 1;
    BEGIN
      IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
        RETURN NEW;
      END IF;
      base := trim(BOTH '-' FROM regexp_replace(
        lower(
          coalesce(NEW.language, '') || '-' ||
          coalesce(NEW.short_code, '') || '-' ||
          coalesce(NEW.finish, '') || '-' ||
          array_to_string(coalesce(NEW.marker_slugs, '{}'), '-') || '-' ||
          coalesce(NEW.size, '')
        ),
        '[^a-z0-9]+', '-', 'g'
      ));
      IF base = '' THEN
        base := 'printing';
      END IF;
      candidate := base;
      WHILE EXISTS (
        SELECT 1 FROM printings WHERE card_id = NEW.card_id AND slug = candidate
      ) LOOP
        n := n + 1;
        candidate := base || '-' || n;
      END LOOP;
      NEW.slug := candidate;
      RETURN NEW;
    END;
    $$`,
  `CREATE TRIGGER printings_set_slug BEFORE INSERT ON printings FOR EACH ROW EXECUTE FUNCTION trg_printings_set_slug()`,

  `ALTER TABLE printings DROP COLUMN face1_id, DROP COLUMN face2_id`,
  `DROP TABLE face_images`,
  `DROP TABLE faces`,
  `DROP FUNCTION trg_faces_normalize_markers()`,

  `CREATE MATERIALIZED VIEW mv_printing_foil_twins AS
    SELECT id AS printing_id
    FROM printings p
    WHERE finish <> 'foil' AND EXISTS (
      SELECT 1 FROM printings q
      WHERE q.card_id = p.card_id AND q.short_code = p.short_code AND q.language = p.language
        AND q.size = p.size AND q.art_variant = p.art_variant AND q.is_signed = p.is_signed
        AND q.is_overnumbered = p.is_overnumbered AND q.marker_slugs = p.marker_slugs AND q.finish = 'foil'
    )`,
  `CREATE UNIQUE INDEX idx_mv_printing_foil_twins_pk ON mv_printing_foil_twins USING btree (printing_id)`,
  `CREATE MATERIALIZED VIEW mv_printings_canonical_rank AS
    SELECT p.id AS printing_id,
      (row_number() OVER (ORDER BY l.sort_order, s.sort_order, p.short_code,
        (array_length(p.marker_slugs, 1) IS NOT NULL),
        COALESCE((SELECT min(m.sort_order) FROM markers m WHERE m.slug = ANY (p.marker_slugs)), 0),
        f.sort_order, cs.sort_order))::integer AS canonical_rank
    FROM printings p
    JOIN sets s ON s.id = p.set_id
    JOIN finishes f ON f.slug = p.finish
    JOIN card_sizes cs ON cs.slug = p.size
    JOIN languages l ON l.code = p.language`,
  `CREATE UNIQUE INDEX idx_mv_printings_canonical_rank_pk ON mv_printings_canonical_rank USING btree (printing_id)`,
  `CREATE VIEW printings_ordered AS
    SELECT p.short_code, p.rarity, p.art_variant, p.is_signed, p.finish, p.artist, p.public_code,
      p.printed_rules_text, p.printed_effect_text, p.created_at, p.updated_at, p.flavor_text, p.id, p.card_id,
      p.set_id, p.comment, p.language, p.printed_name, p.marker_slugs, p.printed_year, p.size,
      p.fallback_art_mode, p.fallback_image_file_id, p.is_overnumbered, p.released_at, p.release_precision,
      p.announced_at, p.slug,
      COALESCE(r.canonical_rank, 2147483647) AS canonical_rank,
      (t.printing_id IS NOT NULL) AS has_foil_twin
    FROM printings p
    LEFT JOIN mv_printings_canonical_rank r ON r.printing_id = p.id
    LEFT JOIN mv_printing_foil_twins t ON t.printing_id = p.id`,
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
