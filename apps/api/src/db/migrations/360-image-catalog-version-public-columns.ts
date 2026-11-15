import type { Kysely } from "kysely";
import { sql } from "kysely";

// The public catalog reads these columns through `public_image_files` and the active-image joins.
const PUBLIC_COLUMNS: [string, string[]][] = [
  ["image_files", ["rehosted_url", "credit"]],
  ["face_images", ["face_id", "image_file_id", "is_active"]],
];

const SCOPES = "'response', 'content'";

const UP = PUBLIC_COLUMNS.flatMap(([table, columns]) => [
  `DROP TRIGGER trg_${table}_catalog_version ON ${table}`,
  `CREATE CONSTRAINT TRIGGER trg_${table}_catalog_version
    AFTER INSERT OR DELETE ON ${table}
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION trg_bump_catalog_versions(${SCOPES})`,
  `CREATE CONSTRAINT TRIGGER trg_${table}_catalog_version_update
    AFTER UPDATE OF ${columns.join(", ")} ON ${table}
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    WHEN (${columns.map((column) => `OLD.${column} IS DISTINCT FROM NEW.${column}`).join(" OR ")})
    EXECUTE FUNCTION trg_bump_catalog_versions(${SCOPES})`,
]);

const DOWN = PUBLIC_COLUMNS.flatMap(([table]) => [
  `DROP TRIGGER trg_${table}_catalog_version_update ON ${table}`,
  `DROP TRIGGER trg_${table}_catalog_version ON ${table}`,
  `CREATE CONSTRAINT TRIGGER trg_${table}_catalog_version
    AFTER INSERT OR UPDATE OR DELETE ON ${table}
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION trg_bump_catalog_versions(${SCOPES})`,
]);

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
