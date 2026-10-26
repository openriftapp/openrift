import type { Kysely } from "kysely";
import { sql } from "kysely";

// `response` keys the `/catalog` ETag, `content` the server-side rule catalog and card lookup index.
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

const UP = [
  `CREATE TABLE catalog_versions (
    scope text PRIMARY KEY,
    version bigint NOT NULL,
    bumped_by xid8
  )`,
  `INSERT INTO catalog_versions (scope, version)
   VALUES ('response', (extract(epoch FROM clock_timestamp()) * 1000)::bigint),
          ('content', (extract(epoch FROM clock_timestamp()) * 1000)::bigint)`,

  // Millisecond floor: a restored dump must not reissue versions the edge cached on the old timeline.
  `CREATE FUNCTION bump_catalog_versions(scopes text[]) RETURNS void LANGUAGE sql AS $fn$
    UPDATE catalog_versions
       SET version = greatest(version + 1, (extract(epoch FROM clock_timestamp()) * 1000)::bigint),
           bumped_by = pg_current_xact_id()
     WHERE scope = ANY (scopes)
       AND bumped_by IS DISTINCT FROM pg_current_xact_id()
  $fn$`,
  `CREATE FUNCTION trg_bump_catalog_versions() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    IF TG_OP = 'UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN
      RETURN NULL;
    END IF;
    PERFORM bump_catalog_versions(TG_ARGV);
    RETURN NULL;
  END
  $fn$`,

  // Deferred to commit, so the counter row is locked only while committing.
  ...TABLE_SCOPES.flatMap(([table, scopes]) => [
    `CREATE CONSTRAINT TRIGGER trg_${table}_catalog_version
      AFTER INSERT OR UPDATE OR DELETE ON ${table}
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION trg_bump_catalog_versions(${args(scopes)})`,
    `CREATE TRIGGER trg_${table}_catalog_version_truncate
      AFTER TRUNCATE ON ${table}
      FOR EACH STATEMENT EXECUTE FUNCTION trg_bump_catalog_versions(${args(scopes)})`,
  ]),
];

const DOWN = [
  ...TABLE_SCOPES.flatMap(([table]) => [
    `DROP TRIGGER trg_${table}_catalog_version_truncate ON ${table}`,
    `DROP TRIGGER trg_${table}_catalog_version ON ${table}`,
  ]),
  `DROP FUNCTION trg_bump_catalog_versions()`,
  `DROP FUNCTION bump_catalog_versions(text[])`,
  `DROP TABLE catalog_versions`,
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
