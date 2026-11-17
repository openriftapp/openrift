import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE user_preferences ALTER COLUMN data SET DEFAULT '{}'::jsonb`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE user_preferences ALTER COLUMN data SET DEFAULT '{"showImages": true, "richEffects": true, "visibleFields": {"type": true, "price": true, "title": true, "number": true, "rarity": true}, "marketplaceOrder": ["tcgplayer", "cardmarket", "cardtrader"]}'::jsonb
  `.execute(db);
}
