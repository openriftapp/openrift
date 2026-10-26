import type { Kysely } from "kysely";
import { sql } from "kysely";

// The rule catalog is assembled from the full `/catalog` response, so `content` covers its tables too.
const RESPONSE_ONLY = [
  "face_images",
  "printing_citations",
  "card_types",
  "super_types",
  "domains",
  "rarities",
  "finishes",
  "art_variants",
  "card_sizes",
  "languages",
  "keywords",
  "keyword_translations",
  "tag_categories",
  "tag_definitions",
];
const CONTENT_ONLY = ["custom_tags", "card_custom_tags", "card_name_aliases"];
const BOTH = [
  "cards",
  "printings",
  "faces",
  "sets",
  "set_releases",
  "card_bans",
  "formats",
  "card_errata",
  "errata_announcements",
  "markers",
  "distribution_channels",
  "printing_distribution_channels",
  "card_domains",
  "card_super_types",
  "card_card_types",
  "card_tokens",
  "image_files",
];

const TABLE_SCOPES: [string, string[]][] = [
  ...RESPONSE_ONLY.map((table): [string, string[]] => [table, ["response"]]),
  ...CONTENT_ONLY.map((table): [string, string[]] => [table, ["content"]]),
  ...BOTH.map((table): [string, string[]] => [table, ["response", "content"]]),
];

const args = (scopes: string[]) => scopes.map((scope) => `'${scope}'`).join(", ");

const versionTrigger = (table: string, scopes: string[]) =>
  `CREATE CONSTRAINT TRIGGER trg_${table}_catalog_version
    AFTER INSERT OR UPDATE OR DELETE ON ${table}
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION trg_bump_catalog_versions(${args(scopes)})`;

const UP = [
  // Locks both rows in one order: two commits bumping different scopes first cannot deadlock.
  `CREATE OR REPLACE FUNCTION bump_catalog_versions(scopes text[]) RETURNS void
    LANGUAGE plpgsql AS $fn$
  BEGIN
    PERFORM 1 FROM catalog_versions ORDER BY scope FOR UPDATE;
    UPDATE catalog_versions
       SET version = greatest(version + 1, (extract(epoch FROM clock_timestamp()) * 1000)::bigint),
           bumped_by = pg_current_xact_id()
     WHERE scope = ANY (scopes)
       AND bumped_by IS DISTINCT FROM pg_current_xact_id();
  END
  $fn$`,
  ...RESPONSE_ONLY.flatMap((table) => [
    `DROP TRIGGER trg_${table}_catalog_version ON ${table}`,
    versionTrigger(table, ["response", "content"]),
  ]),
  ...TABLE_SCOPES.map(
    ([table]) => `DROP TRIGGER trg_${table}_catalog_version_truncate ON ${table}`,
  ),

  `DROP TRIGGER trg_faces_pair_language ON faces`,
  `DROP TRIGGER trg_printings_pair_language ON printings`,
  `DROP FUNCTION check_printing_pair_language()`,
  `CREATE FUNCTION check_printing_pair_language() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM faces f1, faces f2
      WHERE f1.id = NEW.face1_id AND f2.id = NEW.face2_id AND f1.language <> f2.language
    ) THEN
      RAISE EXCEPTION 'both faces of a printing must share one language'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
  END
  $fn$`,
  `CREATE FUNCTION check_face_pair_language() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM printings p
      JOIN faces f1 ON f1.id = p.face1_id
      JOIN faces f2 ON f2.id = p.face2_id
      WHERE (p.face1_id = NEW.id OR p.face2_id = NEW.id) AND f1.language <> f2.language
    ) THEN
      RAISE EXCEPTION 'both faces of a printing must share one language'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
  END
  $fn$`,
  `CREATE CONSTRAINT TRIGGER trg_printings_pair_language
    AFTER INSERT OR UPDATE OF face1_id, face2_id ON printings
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_printing_pair_language()`,
  `CREATE CONSTRAINT TRIGGER trg_faces_pair_language
    AFTER UPDATE OF language ON faces
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_face_pair_language()`,
];

const DOWN = [
  `DROP TRIGGER trg_faces_pair_language ON faces`,
  `DROP TRIGGER trg_printings_pair_language ON printings`,
  `DROP FUNCTION check_face_pair_language()`,
  `DROP FUNCTION check_printing_pair_language()`,
  `CREATE FUNCTION check_printing_pair_language() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM printings p
      JOIN faces f1 ON f1.id = p.face1_id
      JOIN faces f2 ON f2.id = p.face2_id
      WHERE f1.language <> f2.language
        AND (CASE WHEN TG_TABLE_NAME = 'faces'
                  THEN NEW.id IN (p.face1_id, p.face2_id)
                  ELSE p.id = NEW.id END)
    ) THEN
      RAISE EXCEPTION 'both faces of a printing must share one language'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
  END
  $fn$`,
  `CREATE CONSTRAINT TRIGGER trg_printings_pair_language
    AFTER INSERT OR UPDATE OF face1_id, face2_id ON printings
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_printing_pair_language()`,
  `CREATE CONSTRAINT TRIGGER trg_faces_pair_language
    AFTER UPDATE OF language ON faces
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_printing_pair_language()`,

  ...TABLE_SCOPES.map(
    ([table, scopes]) =>
      `CREATE TRIGGER trg_${table}_catalog_version_truncate
        AFTER TRUNCATE ON ${table}
        FOR EACH STATEMENT EXECUTE FUNCTION trg_bump_catalog_versions(${args(scopes)})`,
  ),
  ...RESPONSE_ONLY.flatMap((table) => [
    `DROP TRIGGER trg_${table}_catalog_version ON ${table}`,
    versionTrigger(table, ["response"]),
  ]),
  `CREATE OR REPLACE FUNCTION bump_catalog_versions(scopes text[]) RETURNS void
    LANGUAGE sql AS $fn$
    UPDATE catalog_versions
       SET version = greatest(version + 1, (extract(epoch FROM clock_timestamp()) * 1000)::bigint),
           bumped_by = pg_current_xact_id()
     WHERE scope = ANY (scopes)
       AND bumped_by IS DISTINCT FROM pg_current_xact_id()
  $fn$`,
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
