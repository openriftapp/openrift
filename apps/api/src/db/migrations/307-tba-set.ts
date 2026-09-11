import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    INSERT INTO sets (slug, name, set_type, sort_order)
    VALUES ('TBA', 'Unknown set', 'supplemental', 9999)
    ON CONFLICT (slug) DO NOTHING
  `.execute(db);

  await sql`
    UPDATE printings p
    SET short_code = s.slug || '-TBA-' || c.slug,
        public_code = s.slug || '-TBA'
    FROM sets s, cards c
    WHERE s.id = p.set_id
      AND c.id = p.card_id
      AND (p.public_code = 'TBA' OR p.short_code LIKE 'TBA-%')
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE printings p
    SET short_code = 'TBA-' || c.slug,
        public_code = 'TBA'
    FROM cards c
    WHERE c.id = p.card_id
      AND split_part(p.public_code, '-', 2) = 'TBA'
  `.execute(db);

  await sql`
    DELETE FROM sets
    WHERE slug = 'TBA'
      AND NOT EXISTS (SELECT 1 FROM printings WHERE printings.set_id = sets.id)
  `.execute(db);
}
