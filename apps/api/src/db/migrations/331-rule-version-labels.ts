import type { Kysely } from "kysely";
import { sql } from "kysely";

const CORE_LABELS = [
  ["2025-06-02", "1.0", "Pre-Origins"],
  ["2025-10-01", "1.1", "Origins"],
  ["2025-12-01", "1.2", "Spiritforged"],
  ["2026-03-30", "1.3", "Unleashed"],
  ["2026-07-16", "1.4", "Vendetta"],
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE rule_versions ADD COLUMN label text`.execute(db);
  await sql`ALTER TABLE rule_versions ADD COLUMN document_version text`.execute(db);
  await sql`
    ALTER TABLE rule_versions
    ADD CONSTRAINT chk_rule_versions_label_not_empty CHECK (label <> '')
  `.execute(db);
  await sql`
    ALTER TABLE rule_versions
    ADD CONSTRAINT chk_rule_versions_document_version_not_empty CHECK (document_version <> '')
  `.execute(db);
  for (const [version, documentVersion, label] of CORE_LABELS) {
    await sql`
      UPDATE rule_versions
      SET label = ${label}, document_version = ${documentVersion}
      WHERE kind = 'core' AND version = ${version}
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE rule_versions DROP COLUMN document_version`.execute(db);
  await sql`ALTER TABLE rule_versions DROP COLUMN label`.execute(db);
}
