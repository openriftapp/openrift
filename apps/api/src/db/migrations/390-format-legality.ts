import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE circuits (
      slug text NOT NULL,
      label text NOT NULL,
      country_codes text[] NOT NULL DEFAULT '{}',
      release_language text,
      has_set_ban_lists boolean NOT NULL DEFAULT false,
      sort_order smallint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT pk_circuits PRIMARY KEY (slug),
      CONSTRAINT chk_circuits_slug_not_empty CHECK (slug <> ''),
      CONSTRAINT chk_circuits_label_not_empty CHECK (label <> '')
    )
  `.execute(db);
  await sql`
    INSERT INTO circuits (slug, label, country_codes, release_language, has_set_ban_lists, sort_order) VALUES
      ('china', 'Mainland China', '{CN}', 'SC', false, 0),
      ('korea', 'Korea', '{KR}', 'KR', true, 1),
      ('traditional-chinese', 'Traditional Chinese regions', '{TW,HK,MO}', 'TC', true, 2)
  `.execute(db);

  await sql`
    ALTER TABLE card_bans
      ADD COLUMN circuit text,
      ADD CONSTRAINT fk_card_bans_circuit FOREIGN KEY (circuit) REFERENCES circuits(slug),
      ALTER COLUMN banned_at DROP NOT NULL,
      ADD CONSTRAINT chk_card_bans_undated_is_regional CHECK (banned_at IS NOT NULL OR circuit IS NOT NULL),
      ADD CONSTRAINT chk_card_bans_undated_not_lifted CHECK (banned_at IS NOT NULL OR unbanned_at IS NULL)
  `.execute(db);
  await sql`DROP INDEX uq_card_bans_active`.execute(db);
  await sql`
    CREATE UNIQUE INDEX uq_card_bans_active ON card_bans (card_id, format_id, circuit)
      NULLS NOT DISTINCT WHERE unbanned_at IS NULL
  `.execute(db);

  await sql`
    CREATE TABLE format_sets (
      id uuid NOT NULL DEFAULT uuidv7(),
      format_id text NOT NULL,
      set_id uuid NOT NULL,
      circuit text,
      legal_from date,
      legal_until date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT pk_format_sets PRIMARY KEY (id),
      CONSTRAINT fk_format_sets_format_id FOREIGN KEY (format_id) REFERENCES ban_formats(slug),
      CONSTRAINT fk_format_sets_set_id FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE,
      CONSTRAINT fk_format_sets_circuit FOREIGN KEY (circuit) REFERENCES circuits(slug),
      CONSTRAINT chk_format_sets_window CHECK (
        legal_until IS NULL OR (legal_from IS NOT NULL AND legal_until > legal_from)
      )
    )
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX uq_format_sets_window ON format_sets (format_id, set_id, circuit) NULLS NOT DISTINCT
  `.execute(db);
  await sql`
    CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON format_sets
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);

  for (const table of ["circuits", "format_sets"]) {
    await sql`
      CREATE CONSTRAINT TRIGGER ${sql.ref(`trg_${table}_catalog_version`)}
        AFTER INSERT OR DELETE OR UPDATE ON ${sql.table(table)}
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
        EXECUTE FUNCTION trg_bump_catalog_versions('response', 'content')
    `.execute(db);
  }

  // Standard per Tournament Rules 601.3.c, plus the announced main sets so their
  // cards read "not legal yet" until release. Dates are each set's EN release.
  await sql`
    INSERT INTO format_sets (format_id, set_id, legal_from)
    SELECT 'standard', s.id, r.released_at
    FROM sets s
    LEFT JOIN set_releases r ON r.set_id = s.id AND r.language = 'EN' AND r.precision = 'day'
    WHERE s.slug = 'OGS' OR s.set_type = 'main'
  `.execute(db);
  // Tournament Rules 601.2.b: before release parity a set is legal from its local launch.
  // Proving Grounds ships with Origins, so an undated local OGS release takes OGN's date.
  await sql`
    WITH local AS (
      SELECT g.format_id, g.set_id, g.legal_from AS global_from, c.slug AS circuit,
        coalesce(r.released_at, CASE WHEN s.slug = 'OGS' THEN ogn.released_at END) AS legal_from
      FROM format_sets g
      JOIN sets s ON s.id = g.set_id
      CROSS JOIN circuits c
      LEFT JOIN set_releases r
        ON r.set_id = g.set_id AND r.language = c.release_language AND r.precision = 'day'
      LEFT JOIN set_releases ogn
        ON ogn.set_id = (SELECT id FROM sets WHERE slug = 'OGN')
        AND ogn.language = c.release_language AND ogn.precision = 'day'
      WHERE g.circuit IS NULL
    )
    INSERT INTO format_sets (format_id, set_id, circuit, legal_from)
    SELECT format_id, set_id, circuit, legal_from
    FROM local
    WHERE legal_from IS DISTINCT FROM global_from
  `.execute(db);

  // The 2v2 list began 2026-07-24 as the Constructed list plus Master Yi; Riot's current
  // 2v2 list leaves Fight or Flight out, so it is taken as lifted with the Radiance update.
  await sql`
    INSERT INTO card_bans (card_id, format_id, banned_at, unbanned_at, reason)
    SELECT b.card_id, '2v2', greatest(b.banned_at, DATE '2026-07-24'),
      CASE WHEN c.slug = 'fight-or-flight' THEN DATE '2026-11-23' END, b.reason
    FROM card_bans b
    JOIN cards c ON c.id = b.card_id
    WHERE b.format_id = 'standard' AND b.circuit IS NULL AND b.unbanned_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM card_bans t
        WHERE t.card_id = b.card_id AND t.format_id = '2v2' AND t.circuit IS NULL
      )
    UNION ALL
    SELECT c.id, '2v2', DATE '2026-07-24', NULL, NULL
    FROM cards c
    WHERE c.slug = 'wuju-bladesman-starter'
      AND NOT EXISTS (
        SELECT 1 FROM card_bans t
        WHERE t.card_id = c.id AND t.format_id = '2v2' AND t.circuit IS NULL
      )
  `.execute(db);

  // Riot's 2026-11-23 post moves Korea and the Traditional Chinese regions to
  // per-set ban lists; tying each earlier ban to a set by its date is an inference.
  await sql`
    WITH regional AS (
      SELECT b.card_id, b.format_id, b.banned_at, b.reason, c.slug AS circuit, c.release_language,
        CASE
          WHEN b.banned_at < DATE '2026-05-08' THEN 'SFD'
          WHEN b.banned_at < DATE '2026-10-23' THEN 'VEN'
          ELSE 'RAD'
        END AS anchor_set
      FROM card_bans b
      CROSS JOIN circuits c
      WHERE b.circuit IS NULL AND b.unbanned_at IS NULL
        AND c.has_set_ban_lists
    )
    INSERT INTO card_bans (card_id, format_id, circuit, banned_at, unbanned_at, reason)
    SELECT card_id, format_id, circuit, banned_at, DATE '2026-11-23', reason
    FROM regional
    WHERE banned_at < DATE '2026-11-23'
    UNION ALL
    SELECT g.card_id, g.format_id, g.circuit, r.released_at, NULL, g.reason
    FROM regional g
    JOIN sets s ON s.slug = g.anchor_set
    LEFT JOIN set_releases r
      ON r.set_id = s.id AND r.language = g.release_language AND r.precision = 'day'
  `.execute(db);

  await sql`
    ALTER TABLE tournaments
      ADD COLUMN circuit text,
      ADD CONSTRAINT fk_tournaments_circuit FOREIGN KEY (circuit) REFERENCES circuits(slug)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE tournaments DROP COLUMN circuit`.execute(db);
  await sql`DROP TABLE format_sets`.execute(db);
  await sql`DELETE FROM card_bans WHERE circuit IS NOT NULL`.execute(db);
  // The delete queues deferred catalog-version triggers, which block the index rebuild.
  await sql`SET CONSTRAINTS ALL IMMEDIATE`.execute(db);
  await sql`DROP INDEX uq_card_bans_active`.execute(db);
  await sql`
    CREATE UNIQUE INDEX uq_card_bans_active ON card_bans (card_id, format_id) WHERE unbanned_at IS NULL
  `.execute(db);
  await sql`
    ALTER TABLE card_bans
      DROP CONSTRAINT chk_card_bans_undated_is_regional,
      DROP CONSTRAINT chk_card_bans_undated_not_lifted,
      ALTER COLUMN banned_at SET NOT NULL,
      DROP COLUMN circuit
  `.execute(db);
  await sql`DROP TABLE circuits`.execute(db);
}
