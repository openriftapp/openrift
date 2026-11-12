import type { Kysely } from "kysely";
import { sql } from "kysely";

const LEGACY_SENTINEL = "Former member";

function snapshotFunction(body: { trades: string; loans: string; declare: string }) {
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
  await sql`
    ALTER TABLE card_trades
      ADD COLUMN giver_account_closed boolean NOT NULL DEFAULT false,
      ADD COLUMN receiver_account_closed boolean NOT NULL DEFAULT false,
      DROP CONSTRAINT chk_card_trades_giver_party_shape,
      DROP CONSTRAINT chk_card_trades_receiver_party_shape
  `.execute(db);
  await sql`
    ALTER TABLE loans
      ADD COLUMN borrower_account_closed boolean NOT NULL DEFAULT false,
      DROP CONSTRAINT chk_loans_borrower_shape
  `.execute(db);

  // Trade parties are always accounts, so a NULL user id can only be a closed one.
  await sql`
    UPDATE card_trades
       SET giver_account_closed = true,
           giver_name = NULLIF(giver_name, ${LEGACY_SENTINEL})
     WHERE giver_user_id IS NULL
  `.execute(db);
  await sql`
    UPDATE card_trades
       SET receiver_account_closed = true,
           receiver_name = NULLIF(receiver_name, ${LEGACY_SENTINEL})
     WHERE receiver_user_id IS NULL
  `.execute(db);
  // A loan borrower can also be a free-text name, so only the sentinel marks a closed account.
  await sql`
    UPDATE loans
       SET borrower_account_closed = true,
           borrower_name = NULL
     WHERE borrower_user_id IS NULL AND borrower_name = ${LEGACY_SENTINEL}
  `.execute(db);

  await sql`
    ALTER TABLE card_trades
      ADD CONSTRAINT chk_card_trades_giver_party_shape CHECK (
        CASE WHEN giver_account_closed THEN giver_user_id IS NULL
             ELSE num_nonnulls(giver_user_id, giver_name) = 1 END
      ),
      ADD CONSTRAINT chk_card_trades_receiver_party_shape CHECK (
        CASE WHEN receiver_account_closed THEN receiver_user_id IS NULL
             ELSE num_nonnulls(receiver_user_id, receiver_name) = 1 END
      )
  `.execute(db);
  await sql`
    ALTER TABLE loans
      ADD CONSTRAINT chk_loans_borrower_shape CHECK (
        CASE WHEN borrower_account_closed THEN borrower_user_id IS NULL
             ELSE num_nonnulls(borrower_user_id, borrower_name) = 1 END
      )
  `.execute(db);

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

export async function down(db: Kysely<unknown>): Promise<void> {
  await snapshotFunction({
    declare: `DECLARE\n          display_name text := COALESCE(NULLIF(OLD.name, ''), '${LEGACY_SENTINEL}');`,
    trades: `UPDATE card_trades
             SET giver_user_id = NULL, giver_name = display_name
           WHERE giver_user_id = OLD.id;

          UPDATE card_trades
             SET receiver_user_id = NULL, receiver_name = display_name
           WHERE receiver_user_id = OLD.id;`,
    loans: `UPDATE loans
             SET borrower_user_id = NULL, borrower_name = display_name
           WHERE borrower_user_id = OLD.id;`,
  }).execute(db);

  await sql`
    ALTER TABLE card_trades
      DROP CONSTRAINT chk_card_trades_giver_party_shape,
      DROP CONSTRAINT chk_card_trades_receiver_party_shape
  `.execute(db);
  await sql`ALTER TABLE loans DROP CONSTRAINT chk_loans_borrower_shape`.execute(db);

  await sql`
    UPDATE card_trades SET giver_name = ${LEGACY_SENTINEL}
     WHERE giver_account_closed AND giver_name IS NULL
  `.execute(db);
  await sql`
    UPDATE card_trades SET receiver_name = ${LEGACY_SENTINEL}
     WHERE receiver_account_closed AND receiver_name IS NULL
  `.execute(db);
  await sql`
    UPDATE loans SET borrower_name = ${LEGACY_SENTINEL}
     WHERE borrower_account_closed AND borrower_name IS NULL
  `.execute(db);

  await sql`
    ALTER TABLE card_trades
      DROP COLUMN giver_account_closed,
      DROP COLUMN receiver_account_closed,
      ADD CONSTRAINT chk_card_trades_giver_party_shape CHECK (num_nonnulls(giver_user_id, giver_name) = 1),
      ADD CONSTRAINT chk_card_trades_receiver_party_shape CHECK (num_nonnulls(receiver_user_id, receiver_name) = 1)
  `.execute(db);
  await sql`
    ALTER TABLE loans
      DROP COLUMN borrower_account_closed,
      ADD CONSTRAINT chk_loans_borrower_shape CHECK (num_nonnulls(borrower_user_id, borrower_name) = 1)
  `.execute(db);
}
