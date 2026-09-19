import type { Kysely } from "kysely";
import { sql } from "kysely";

// Borrower-declared returns (ADR-039, amended 2026-09-19). Holds the part of
// `returned_quantity` the borrower recorded and the lender has not reviewed:
// confirming zeroes it, reopening subtracts it back out of `returned_quantity`.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE loans
      ADD COLUMN borrower_returned_quantity integer NOT NULL DEFAULT 0,
      ADD CONSTRAINT chk_loans_borrower_returned_bounds
        CHECK (borrower_returned_quantity >= 0 AND borrower_returned_quantity <= returned_quantity)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE loans DROP COLUMN borrower_returned_quantity`.execute(db);
}
