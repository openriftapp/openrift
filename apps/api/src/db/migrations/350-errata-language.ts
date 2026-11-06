import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE card_errata
      ADD COLUMN language text NOT NULL DEFAULT 'EN',
      ADD CONSTRAINT card_errata_language_fk
        FOREIGN KEY (language) REFERENCES languages(code) ON UPDATE CASCADE,
      DROP CONSTRAINT card_errata_card_id_unique,
      ADD CONSTRAINT card_errata_card_id_language_unique UNIQUE (card_id, language)
  `.execute(db);
}

// Fails while a card has errata in more than one language.
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE card_errata
      DROP CONSTRAINT card_errata_card_id_language_unique,
      ADD CONSTRAINT card_errata_card_id_unique UNIQUE (card_id),
      DROP CONSTRAINT card_errata_language_fk,
      DROP COLUMN language
  `.execute(db);
}
