import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE candidate_fingerprint_failures (
      candidate_printing_id uuid NOT NULL,
      image_url text NOT NULL,
      attempts integer NOT NULL,
      last_error text NOT NULL,
      last_attempt_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT pk_candidate_fingerprint_failures PRIMARY KEY (candidate_printing_id),
      CONSTRAINT fk_candidate_fingerprint_failures_candidate_printing_id
        FOREIGN KEY (candidate_printing_id) REFERENCES candidate_printings(id) ON DELETE CASCADE,
      CONSTRAINT chk_candidate_fingerprint_failures_attempts CHECK (attempts > 0),
      CONSTRAINT chk_candidate_fingerprint_failures_last_error CHECK (last_error <> '')
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE candidate_fingerprint_failures`.execute(db);
}
