import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * An erratum either belongs to an official announcement or is unannounced, in
 * which case `source` says where the change was seen and `effective_date` when.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("errata_announcements")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuidv7()`))
    .addColumn("name", "text", (col) => col.notNull().unique())
    .addColumn("published_on", "date", (col) => col.notNull())
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`now()`).notNull())
    .addCheckConstraint("chk_errata_announcements_name_not_empty", sql`name <> ''`)
    .addCheckConstraint("chk_errata_announcements_url_not_empty", sql`url <> ''`)
    .execute();

  await sql`
    ALTER TABLE card_errata
      ADD COLUMN announcement_id uuid REFERENCES errata_announcements(id),
      ALTER COLUMN source DROP NOT NULL
  `.execute(db);
  await sql`CREATE INDEX idx_card_errata_announcement ON card_errata (announcement_id)`.execute(db);

  await sql`
    INSERT INTO errata_announcements (name, published_on, url)
    SELECT DISTINCT ON (source) source, effective_date, source_url
    FROM card_errata
    WHERE source_url IS NOT NULL AND effective_date IS NOT NULL
    ORDER BY source, effective_date
  `.execute(db);
  await sql`
    UPDATE card_errata ce
    SET announcement_id = a.id, source = NULL, source_url = NULL, effective_date = NULL
    FROM errata_announcements a
    WHERE ce.source = a.name AND ce.source_url = a.url AND ce.effective_date = a.published_on
  `.execute(db);

  await sql`
    ALTER TABLE card_errata
      ADD CONSTRAINT chk_card_errata_origin
        CHECK ((announcement_id IS NULL) = (source IS NOT NULL)),
      ADD CONSTRAINT chk_card_errata_announced_has_no_note
        CHECK (announcement_id IS NULL OR (source_url IS NULL AND effective_date IS NULL))
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE card_errata
      DROP CONSTRAINT chk_card_errata_origin,
      DROP CONSTRAINT chk_card_errata_announced_has_no_note
  `.execute(db);
  await sql`
    UPDATE card_errata ce
    SET source = a.name, source_url = a.url, effective_date = a.published_on
    FROM errata_announcements a
    WHERE ce.announcement_id = a.id
  `.execute(db);
  await sql`
    ALTER TABLE card_errata
      DROP COLUMN announcement_id,
      ALTER COLUMN source SET NOT NULL
  `.execute(db);
  await db.schema.dropTable("errata_announcements").execute();
}
