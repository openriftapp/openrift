import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE tournaments SET deck_format = 'constructed' WHERE deck_format IS NULL`.execute(
    db,
  );
  await sql`
    ALTER TABLE tournaments
      ALTER COLUMN deck_format SET DEFAULT 'constructed',
      ALTER COLUMN deck_format SET NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE tournaments
      ALTER COLUMN deck_format DROP NOT NULL,
      ALTER COLUMN deck_format DROP DEFAULT
  `.execute(db);
}
