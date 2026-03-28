import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Fix preferences rows corrupted by double-serialization.
 *
 * postgres.js under Bun returns jsonb as a string. The old code spread that
 * string (`{...current, ...incoming}`), which turned each character into a
 * numbered key ("0", "1", …). Each PATCH save grew the blob ~10× until some
 * rows reached 65 MB, choking the API server.
 *
 * Any row whose `data` exceeds 1 KB is corrupted beyond recovery — reset it
 * to defaults so the user gets a working (if default) experience.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE user_preferences
    SET data = '{"showImages":true,"fancyFan":true,"foilEffect":"animated","cardTilt":true,"visibleFields":{"number":true,"title":true,"type":true,"rarity":true,"price":true},"theme":"light","marketplaceOrder":["tcgplayer","cardmarket","cardtrader"]}'::jsonb
    WHERE length(data::text) > 1000
  `.execute(db);
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // The corrupted data cannot be restored — this is intentionally a no-op.
}
