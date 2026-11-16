import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE tournament_legend_meta_shares
      DROP CONSTRAINT chk_tournament_legend_meta_shares_share,
      ALTER COLUMN share TYPE numeric(12,3),
      ADD CONSTRAINT chk_tournament_legend_meta_shares_share CHECK (share >= 0)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM tournament_legend_meta_shares WHERE share > 100`.execute(db);
  await sql`
    ALTER TABLE tournament_legend_meta_shares
      DROP CONSTRAINT chk_tournament_legend_meta_shares_share,
      ALTER COLUMN share TYPE numeric(6,3),
      ADD CONSTRAINT chk_tournament_legend_meta_shares_share CHECK (share >= 0 AND share <= 100)
  `.execute(db);
}
