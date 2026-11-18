import type { Kysely } from "kysely";
import { sql } from "kysely";

function snapshotFunction(body: { declare: string; participants: string }) {
  return sql.raw(`
    CREATE OR REPLACE FUNCTION public.snapshot_deleted_user_names() RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        ${body.declare}
        BEGIN
          -- A live trade needs two people. Close the ones this account was in
          -- before snapshotting, so no request or reservation is left waiting on
          -- somebody who is gone, and release the copies a reservation had pinned.
          -- This is what leaving a group already does to that member's live trades.
          DELETE FROM card_trade_copies
           WHERE trade_id IN (
             SELECT id FROM card_trades
              WHERE (giver_user_id = OLD.id OR receiver_user_id = OLD.id)
                AND status IN ('pending', 'reserved')
           );

          UPDATE card_trades
             SET status = 'cancelled',
                 closed_at = now(),
                 expires_at = NULL,
                 last_actor_user_id = NULL
           WHERE (giver_user_id = OLD.id OR receiver_user_id = OLD.id)
             AND status IN ('pending', 'reserved');

          UPDATE card_trades
             SET giver_user_id = NULL, giver_name = NULL, giver_account_closed = true
           WHERE giver_user_id = OLD.id;

          UPDATE card_trades
             SET receiver_user_id = NULL, receiver_name = NULL, receiver_account_closed = true
           WHERE receiver_user_id = OLD.id;

          UPDATE loans
             SET borrower_user_id = NULL, borrower_name = NULL, borrower_account_closed = true
           WHERE borrower_user_id = OLD.id;

          ${body.participants}

          RETURN OLD;
        END;
        $$;
  `);
}

const PARTICIPANTS_BODY = `UPDATE tournament_participants
             SET user_id = NULL,
                 display_name = NULL,
                 riot_id = NULL,
                 claim_token = NULL,
                 account_closed = true
           WHERE user_id = OLD.id;`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE tournament_participants
      ADD COLUMN account_closed boolean NOT NULL DEFAULT false,
      ALTER COLUMN display_name DROP NOT NULL,
      DROP CONSTRAINT chk_tournament_participants_name
  `.execute(db);

  // Every path that links an account stamps claimed_at and every unlink clears it,
  // so a linked row whose account is gone is the only one left with a claim and no user.
  await sql`
    UPDATE tournament_participants
       SET account_closed = true,
           display_name = NULL,
           riot_id = NULL,
           claim_token = NULL
     WHERE user_id IS NULL AND claimed_at IS NOT NULL
  `.execute(db);

  await sql`
    ALTER TABLE tournament_participants
      ADD CONSTRAINT chk_tournament_participants_name CHECK (
        CASE WHEN account_closed
             THEN user_id IS NULL AND display_name IS NULL AND riot_id IS NULL
             ELSE display_name IS NOT NULL AND length(display_name) BETWEEN 1 AND 120 END
      )
  `.execute(db);

  await snapshotFunction({ declare: "", participants: PARTICIPANTS_BODY }).execute(db);
}

/** The names cleared by up() are gone; rolling back writes a placeholder into those rows. */
export async function down(db: Kysely<unknown>): Promise<void> {
  await snapshotFunction({ declare: "", participants: "" }).execute(db);
  await sql`
    ALTER TABLE tournament_participants DROP CONSTRAINT chk_tournament_participants_name
  `.execute(db);
  await sql`
    UPDATE tournament_participants SET display_name = 'Former member'
     WHERE account_closed AND display_name IS NULL
  `.execute(db);
  await sql`
    ALTER TABLE tournament_participants
      DROP COLUMN account_closed,
      ALTER COLUMN display_name SET NOT NULL,
      ADD CONSTRAINT chk_tournament_participants_name CHECK (
        (length(display_name) >= 1) AND (length(display_name) <= 120)
      )
  `.execute(db);
}
