import type { Kysely } from "kysely";
import { sql } from "kysely";

// The fingerprint sweep could not read contributor uploads and marked them done with
// no fingerprint. Clearing the URL queues them for the next sweep.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE candidate_printings
    SET image_fingerprint_url = NULL
    WHERE image_fingerprint IS NULL
      AND image_url LIKE '/media/submissions/%'
  `.execute(db);
}

// oxlint-disable-next-line eslint/no-empty-function -- the cleared URLs carry no state to restore
export async function down(): Promise<void> {}
