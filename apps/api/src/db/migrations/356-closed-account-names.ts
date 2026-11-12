import type { Kysely } from "kysely";
import { sql } from "kysely";

function snapshotFunction(body: { declare: string; trades: string; loans: string }) {
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

          ${body.trades}

          ${body.loans}

          RETURN OLD;
        END;
        $$;
  `);
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await snapshotFunction({
    declare: "",
    trades: `UPDATE card_trades
             SET giver_user_id = NULL, giver_name = NULL, giver_account_closed = true
           WHERE giver_user_id = OLD.id;

          UPDATE card_trades
             SET receiver_user_id = NULL, receiver_name = NULL, receiver_account_closed = true
           WHERE receiver_user_id = OLD.id;`,
    loans: `UPDATE loans
             SET borrower_user_id = NULL, borrower_name = NULL, borrower_account_closed = true
           WHERE borrower_user_id = OLD.id;`,
  }).execute(db);

  await sql`UPDATE card_trades SET giver_name = NULL WHERE giver_account_closed AND giver_name IS NOT NULL`.execute(
    db,
  );
  await sql`UPDATE card_trades SET receiver_name = NULL WHERE receiver_account_closed AND receiver_name IS NOT NULL`.execute(
    db,
  );
  await sql`UPDATE loans SET borrower_name = NULL WHERE borrower_account_closed AND borrower_name IS NOT NULL`.execute(
    db,
  );
}

// The names cleared by up() are gone; rolling back restores only the trigger that keeps them.
export async function down(db: Kysely<unknown>): Promise<void> {
  await snapshotFunction({
    declare: "DECLARE\n          display_name text := NULLIF(OLD.name, '');",
    trades: `UPDATE card_trades
             SET giver_user_id = NULL, giver_name = display_name, giver_account_closed = true
           WHERE giver_user_id = OLD.id;

          UPDATE card_trades
             SET receiver_user_id = NULL, receiver_name = display_name, receiver_account_closed = true
           WHERE receiver_user_id = OLD.id;`,
    loans: `UPDATE loans
             SET borrower_user_id = NULL, borrower_name = display_name, borrower_account_closed = true
           WHERE borrower_user_id = OLD.id;`,
  }).execute(db);
}
