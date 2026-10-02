import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE rule_versions
      ADD COLUMN language TEXT NOT NULL DEFAULT 'en'
        CONSTRAINT rule_versions_language_check CHECK (language IN ('en', 'fr', 'ko', 'zh-Hans'))
  `.execute(db);
  await sql`ALTER TABLE rule_versions ALTER COLUMN language DROP DEFAULT`.execute(db);

  await sql`
    ALTER TABLE rules
      ADD COLUMN language TEXT NOT NULL DEFAULT 'en'
        CONSTRAINT rules_language_check CHECK (language IN ('en', 'fr', 'ko', 'zh-Hans'))
  `.execute(db);
  await sql`ALTER TABLE rules ALTER COLUMN language DROP DEFAULT`.execute(db);

  await sql`ALTER TABLE rules DROP CONSTRAINT rules_change_type_check`.execute(db);
  await sql`
    ALTER TABLE rules
      ADD CONSTRAINT rules_change_type_check
        CHECK (change_type IN ('added', 'modified', 'removed', 'unchanged'))
  `.execute(db);

  await sql`ALTER TABLE rules DROP CONSTRAINT rules_kind_version_fkey`.execute(db);
  await sql`ALTER TABLE rules DROP CONSTRAINT rules_kind_version_rule_number_key`.execute(db);
  await sql`
    ALTER TABLE rules
      ADD CONSTRAINT rules_kind_language_version_rule_number_key
        UNIQUE (kind, language, version, rule_number)
  `.execute(db);

  await sql`ALTER TABLE rule_versions DROP CONSTRAINT rule_versions_pkey`.execute(db);
  await sql`ALTER TABLE rule_versions ADD PRIMARY KEY (kind, language, version)`.execute(db);

  await sql`
    ALTER TABLE rules
      ADD CONSTRAINT rules_kind_language_version_fkey
        FOREIGN KEY (kind, language, version)
        REFERENCES rule_versions(kind, language, version) ON DELETE CASCADE
  `.execute(db);

  await sql`DROP INDEX idx_rules_kind_version_sort`.execute(db);
  await sql`
    CREATE INDEX idx_rules_kind_language_version_sort
      ON rules (kind, language, version, sort_order)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM rule_versions WHERE language <> 'en'`.execute(db);

  await sql`ALTER TABLE rules DROP CONSTRAINT rules_change_type_check`.execute(db);
  await sql`
    ALTER TABLE rules
      ADD CONSTRAINT rules_change_type_check CHECK (change_type IN ('added', 'modified', 'removed'))
  `.execute(db);

  await sql`DROP INDEX idx_rules_kind_language_version_sort`.execute(db);
  await sql`CREATE INDEX idx_rules_kind_version_sort ON rules (kind, version, sort_order)`.execute(
    db,
  );

  await sql`ALTER TABLE rules DROP CONSTRAINT rules_kind_language_version_fkey`.execute(db);

  await sql`ALTER TABLE rule_versions DROP CONSTRAINT rule_versions_pkey`.execute(db);
  await sql`ALTER TABLE rule_versions ADD PRIMARY KEY (kind, version)`.execute(db);

  await sql`ALTER TABLE rules DROP CONSTRAINT rules_kind_language_version_rule_number_key`.execute(
    db,
  );
  await sql`
    ALTER TABLE rules
      ADD CONSTRAINT rules_kind_version_rule_number_key UNIQUE (kind, version, rule_number)
  `.execute(db);

  await sql`
    ALTER TABLE rules
      ADD CONSTRAINT rules_kind_version_fkey
        FOREIGN KEY (kind, version) REFERENCES rule_versions(kind, version) ON DELETE CASCADE
  `.execute(db);

  await sql`ALTER TABLE rules DROP COLUMN language`.execute(db);
  await sql`ALTER TABLE rule_versions DROP COLUMN language`.execute(db);
}
