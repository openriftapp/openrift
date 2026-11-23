import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE image_files ADD COLUMN needs_levels boolean NOT NULL DEFAULT false`.execute(
    db,
  );
  await sql`UPDATE image_files SET needs_levels = true WHERE needs_trim`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE image_files DROP COLUMN needs_levels`.execute(db);
}
