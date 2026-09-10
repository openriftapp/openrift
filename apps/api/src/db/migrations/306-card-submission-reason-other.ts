import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE card_submissions DROP CONSTRAINT chk_card_submissions_reason`.execute(db);
  await sql`ALTER TABLE card_submissions ADD CONSTRAINT chk_card_submissions_reason CHECK (resolution_reason IS NULL OR resolution_reason IN ('duplicate', 'already_correct', 'unverified', 'not_a_card', 'bad_image', 'other'))`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE card_submissions SET resolution_reason = NULL WHERE resolution_reason = 'other'`.execute(
    db,
  );
  await sql`ALTER TABLE card_submissions DROP CONSTRAINT chk_card_submissions_reason`.execute(db);
  await sql`ALTER TABLE card_submissions ADD CONSTRAINT chk_card_submissions_reason CHECK (resolution_reason IS NULL OR resolution_reason IN ('duplicate', 'already_correct', 'unverified', 'not_a_card', 'bad_image'))`.execute(
    db,
  );
}
