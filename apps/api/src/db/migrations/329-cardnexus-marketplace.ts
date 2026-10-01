import type { Kysely } from "kysely";
import { sql } from "kysely";

const MARKETPLACE_TABLES = [
  "marketplace_products",
  "marketplace_groups",
  "marketplace_ignored_products",
];

async function replaceCheck(db: Kysely<unknown>, marketplaces: readonly string[]): Promise<void> {
  const values = sql.join(marketplaces.map((marketplace) => sql.lit(marketplace)));
  for (const table of MARKETPLACE_TABLES) {
    const constraint = sql.ref(`chk_${table}_marketplace`);
    await sql`ALTER TABLE ${sql.ref(table)} DROP CONSTRAINT ${constraint}`.execute(db);
    await sql`
      ALTER TABLE ${sql.ref(table)}
      ADD CONSTRAINT ${constraint} CHECK (marketplace = ANY (ARRAY[${values}]))
    `.execute(db);
  }
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await replaceCheck(db, ["tcgplayer", "cardmarket", "cardtrader", "cardnexus"]);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM marketplace_product_variants
    WHERE marketplace_product_id IN (
      SELECT id FROM marketplace_products WHERE marketplace = 'cardnexus'
    )
  `.execute(db);
  await sql`DELETE FROM marketplace_products WHERE marketplace = 'cardnexus'`.execute(db);
  await sql`DELETE FROM marketplace_ignored_products WHERE marketplace = 'cardnexus'`.execute(db);
  await sql`DELETE FROM marketplace_groups WHERE marketplace = 'cardnexus'`.execute(db);
  await replaceCheck(db, ["tcgplayer", "cardmarket", "cardtrader"]);
}
