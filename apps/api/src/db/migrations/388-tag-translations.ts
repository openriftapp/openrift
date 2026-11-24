import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE tag_translations (
      tag text NOT NULL,
      language text NOT NULL,
      label text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT pk_tag_translations PRIMARY KEY (language, label),
      CONSTRAINT fk_tag_translations_language
        FOREIGN KEY (language) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT chk_tag_translations_tag_not_empty CHECK (tag <> ''),
      CONSTRAINT chk_tag_translations_label_not_empty CHECK (label <> '')
    )
  `.execute(db);
  await sql`CREATE INDEX idx_tag_translations_label ON tag_translations (label)`.execute(db);
  await sql`
    CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON tag_translations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE tag_translations`.execute(db);
}
