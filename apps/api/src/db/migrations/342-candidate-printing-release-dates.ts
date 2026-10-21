import type { Kysely } from "kysely";
import { sql } from "kysely";

const UP = [
  `ALTER TABLE candidate_printings
    ADD COLUMN released_at date,
    ADD COLUMN release_precision release_precision,
    ADD COLUMN announced_at date`,
  `ALTER TABLE candidate_printings
    ADD CONSTRAINT chk_candidate_printings_release_precision
      CHECK ((released_at IS NULL) = (release_precision IS NULL))`,
  `ALTER TABLE candidate_printings
    ADD CONSTRAINT chk_candidate_printings_release_period_start CHECK (
      released_at IS NULL
      OR release_precision = 'day'
      OR (release_precision = 'month' AND extract(day FROM released_at) = 1)
      OR (release_precision = 'quarter' AND extract(day FROM released_at) = 1
          AND extract(month FROM released_at) IN (1, 4, 7, 10))
      OR (release_precision = 'year' AND extract(doy FROM released_at) = 1)
    )`,
];

const DOWN = [
  `ALTER TABLE candidate_printings
    DROP CONSTRAINT chk_candidate_printings_release_period_start,
    DROP CONSTRAINT chk_candidate_printings_release_precision,
    DROP COLUMN announced_at,
    DROP COLUMN release_precision,
    DROP COLUMN released_at`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of UP) {
    await sql.raw(statement).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const statement of DOWN) {
    await sql.raw(statement).execute(db);
  }
}
