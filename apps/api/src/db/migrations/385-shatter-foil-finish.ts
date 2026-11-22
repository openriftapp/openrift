import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    INSERT INTO finishes (slug, label, sort_order, is_well_known)
    VALUES ('shatter-foil', 'Shatter Foil', 2, true)
    ON CONFLICT (slug) DO UPDATE SET is_well_known = true
  `.execute(db);
  await sql`
    UPDATE finishes SET sort_order = CASE slug
      WHEN 'normal' THEN 0
      WHEN 'foil' THEN 1
      WHEN 'shatter-foil' THEN 2
      WHEN 'metal' THEN 3
      WHEN 'metal-deluxe' THEN 4
      ELSE sort_order
    END
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`SET CONSTRAINTS trg_finishes_catalog_version IMMEDIATE`.execute(db);
  await sql`ALTER TABLE finishes DISABLE TRIGGER trg_finishes_protect_well_known`.execute(db);
  await sql`UPDATE finishes SET is_well_known = false WHERE slug = 'shatter-foil'`.execute(db);
  await sql`ALTER TABLE finishes ENABLE TRIGGER trg_finishes_protect_well_known`.execute(db);
  await sql`SET CONSTRAINTS trg_finishes_catalog_version DEFERRED`.execute(db);
}
