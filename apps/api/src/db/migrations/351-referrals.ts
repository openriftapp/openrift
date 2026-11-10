import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE users
      ADD COLUMN referral_code text,
      ADD COLUMN referred_by text,
      ADD COLUMN profile_show_referral_tier boolean NOT NULL DEFAULT true,
      ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code),
      ADD CONSTRAINT users_referred_by_fk
        FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL,
      ADD CONSTRAINT chk_users_referred_by_not_self CHECK (referred_by <> id)
  `.execute(db);
  await sql`CREATE INDEX idx_users_referred_by ON users (referred_by) WHERE referred_by IS NOT NULL`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX idx_users_referred_by`.execute(db);
  await sql`
    ALTER TABLE users
      DROP CONSTRAINT chk_users_referred_by_not_self,
      DROP CONSTRAINT users_referred_by_fk,
      DROP CONSTRAINT users_referral_code_unique,
      DROP COLUMN profile_show_referral_tier,
      DROP COLUMN referred_by,
      DROP COLUMN referral_code
  `.execute(db);
}
