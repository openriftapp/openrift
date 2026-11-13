import { WellKnown } from "@openrift/shared/well-known";
import type { Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { MarketplaceProductPricesTable } from "../../../db/tables/marketplace.js";

export interface MarketplaceSourceRow {
  printingId: string;
  variantId: string;
  externalId: number;
  marketplace: string;
  /** The printing's own language, which the Cardmarket link filters by. */
  language: string;
}

/**
 * Picks the product whose own headline on the view's latest day equals the view's headline.
 * `own` mirrors the view's per-product expression; marketplace.test.ts compares the two.
 */
async function selectSources(
  db: Kysely<Database>,
  printingIds?: readonly string[],
): Promise<MarketplaceSourceRow[]> {
  const filter = printingIds ? sql`WHERE mpv.printing_id IN (${sql.join(printingIds)})` : sql``;
  const result = await sql<MarketplaceSourceRow>`
    SELECT DISTINCT ON (mpv.printing_id, mp.marketplace)
      mpv.printing_id AS "printingId",
      mpv.id AS "variantId",
      mp.external_id AS "externalId",
      mp.marketplace AS "marketplace",
      pf.language AS "language"
    FROM marketplace_product_variants mpv
    INNER JOIN marketplace_products mp ON mp.id = mpv.marketplace_product_id
    INNER JOIN printings p ON p.id = mpv.printing_id
    INNER JOIN faces pf ON pf.id = p.face1_id
    LEFT JOIN mv_latest_printing_prices lp
      ON lp.printing_id = mpv.printing_id AND lp.marketplace = mp.marketplace
    LEFT JOIN LATERAL (
      SELECT CASE
          WHEN mp.marketplace = 'cardtrader' THEN COALESCE(carry.zero_low_cents, day_row.low_cents)
          WHEN mp.marketplace = 'cardmarket' THEN COALESCE(day_row.low_cents, day_row.market_cents)
          ELSE COALESCE(day_row.market_cents, day_row.low_cents)
        END AS headline_cents
      FROM (
        SELECT pp.low_cents, pp.market_cents
        FROM marketplace_product_prices pp
        WHERE pp.marketplace_product_id = mp.id
          AND pp.recorded_at >= lp.last_seen
          AND pp.recorded_at < lp.last_seen + 1
        ORDER BY (pp.zero_low_cents IS NULL), pp.recorded_at DESC
        LIMIT 1
      ) day_row
      LEFT JOIN LATERAL (
        SELECT pp.zero_low_cents
        FROM marketplace_product_prices pp
        WHERE pp.marketplace_product_id = mp.id
          AND mp.marketplace = 'cardtrader'
          AND pp.zero_low_cents IS NOT NULL
          AND pp.recorded_at < lp.last_seen + 1
        ORDER BY pp.recorded_at DESC
        LIMIT 1
      ) carry ON true
    ) own ON true
    ${filter}
    ORDER BY
      mpv.printing_id,
      mp.marketplace,
      (own.headline_cents = lp.headline_cents) IS TRUE DESC,
      mp.external_id,
      mpv.id
  `.execute(db);
  return result.rows;
}

/**
 * Price queries read from `mv_daily_printing_prices` and its latest-day
 * derivative `mv_latest_printing_prices`, both refreshed after each
 * price-refresh pipeline run (see {@link refreshLatestPrices}). The headline
 * rule and the "cheapest bound SKU" aggregation live in the daily view, so
 * every surface that prices a printing agrees by construction. Don't
 * re-implement the headline CASE in a query here, except in {@link selectSources}.
 */
export function marketplacePricesRepo(db: Kysely<Database>) {
  return {
    latestPrices(): Promise<{ printingId: string; marketplace: string; headlineCents: number }[]> {
      return db
        .selectFrom("mvLatestPrintingPrices")
        .select(["printingId", "marketplace", "headlineCents"])
        .execute();
    },

    /**
     * Cheap content token over {@link latestPrices}, for the content-addressed
     * price memo in `createRepos` (dynamic list rules that filter on price).
     * Hashes the materialized view itself — not the base snapshot tables — so
     * the token rolls exactly when {@link refreshLatestPrices} publishes new
     * data. A base-table probe would roll mid-pipeline (inserts land before
     * the refresh), caching the old view under the new token and then serving
     * it stale after the refresh until the next pipeline run.
     */
    async latestPricesContentVersion(): Promise<string> {
      const result = await sql<{ token: string }>`
        SELECT
          coalesce(count(*)::text, '0') || '|' ||
          coalesce(md5(string_agg(printing_id::text || ':' || marketplace || ':' || headline_cents::text || ':' || last_seen::text, ',' ORDER BY printing_id, marketplace)), '') AS token
        FROM mv_latest_printing_prices
      `.execute(db);
      return result.rows[0]?.token ?? "";
    },

    latestPricesForPrintings(
      printingIds: string[],
    ): Promise<{ printingId: string; marketplace: string; headlineCents: number }[]> {
      if (printingIds.length === 0) {
        return Promise.resolve([]);
      }
      return db
        .selectFrom("mvLatestPrintingPrices")
        .select(["printingId", "marketplace", "headlineCents"])
        .where("printingId", "in", printingIds)
        .execute();
    },

    sourcesForPrintings(printingIds: string[]): Promise<MarketplaceSourceRow[]> {
      if (printingIds.length === 0) {
        return Promise.resolve([]);
      }
      return selectSources(db, printingIds);
    },

    sourcesForAllPrintings(): Promise<MarketplaceSourceRow[]> {
      return selectSources(db);
    },

    /**
     * Price history for the product a variant is bound to. Every variant for
     * the same SKU resolves to the same history — prices live on the product,
     * not the binding.
     */
    snapshots(
      variantId: string,
      cutoff: Date | null,
    ): Promise<
      Pick<
        Selectable<MarketplaceProductPricesTable>,
        "recordedAt" | "marketCents" | "lowCents" | "zeroLowCents"
      >[]
    > {
      let query = db
        .selectFrom("marketplaceProductPrices as pp")
        .innerJoin(
          "marketplaceProductVariants as mpv",
          "mpv.marketplaceProductId",
          "pp.marketplaceProductId",
        )
        .select(["pp.recordedAt", "pp.marketCents", "pp.lowCents", "pp.zeroLowCents"])
        .where("mpv.id", "=", variantId)
        .orderBy("pp.recordedAt", "asc");
      if (cutoff) {
        query = query.where("pp.recordedAt", ">=", cutoff);
      }
      return query.execute();
    },

    /**
     * Overflow is skipped — it's a parking zone for cards the user hasn't
     * committed to the deck, and the deck editor leaves it out of its own
     * value figure too (see `computeDeckOwnership` in the web app).
     *
     * `languages` mirrors `cheapestPrice` in the web app's
     * `computeDeckOwnership` exactly, so a deck tile and the deck page quote
     * the same basis: the cheapest priced printing whose language the viewer
     * collects, falling back to the cheapest priced printing in any language
     * when the card has none priced in those. This matters on marketplaces
     * with per-language prices (CardTrader) — without it a cheap foreign
     * printing drags the tile below what the deck page shows. An empty list
     * means "no language preference" and prices at the plain cheapest.
     *
     * Cards priced at the same double-sided printing share its copies: the deck pays for the
     * larger card's count once, not for each card.
     */
    async deckValues(
      userId: string,
      marketplace: string,
      languages?: readonly string[],
    ): Promise<Map<string, { totalValueCents: number; unpricedCount: number }>> {
      const preferredLanguages = [...(languages ?? [])];
      const rows = await sql<{ deckId: string; totalValueCents: number; unpricedCount: number }>`
        WITH priced AS (
          SELECT dc.deck_id, dc.card_id, dc.quantity, cheapest.printing_id, cheapest.headline_cents
          FROM deck_cards dc
          INNER JOIN decks d ON d.id = dc.deck_id AND d.user_id = ${userId}
          LEFT JOIN LATERAL (
            SELECT p.printing_id, mvp.headline_cents
            FROM printing_sides_ordered p
            INNER JOIN mv_latest_printing_prices mvp
              ON mvp.printing_id = p.printing_id AND mvp.marketplace = ${marketplace}
            WHERE p.card_id = dc.card_id
            ORDER BY
              (p.language = ANY(${preferredLanguages}::text[])) DESC,
              mvp.headline_cents,
              p.printing_id
            LIMIT 1
          ) cheapest ON true
          WHERE dc.zone <> ${WellKnown.deckZone.OVERFLOW}
        ),
        per_card AS (
          SELECT deck_id, printing_id, card_id, SUM(quantity) AS quantity,
            MAX(headline_cents) AS headline_cents
          FROM priced
          WHERE printing_id IS NOT NULL
          GROUP BY deck_id, printing_id, card_id
        ),
        per_printing AS (
          SELECT deck_id, MAX(quantity) * MAX(headline_cents) AS value_cents
          FROM per_card
          GROUP BY deck_id, printing_id
        )
        SELECT
          decks.deck_id AS "deckId",
          COALESCE(SUM(per_printing.value_cents), 0)::int AS "totalValueCents",
          (
            SELECT COALESCE(SUM(unpriced.quantity), 0)::int
            FROM priced unpriced
            WHERE unpriced.deck_id = decks.deck_id AND unpriced.printing_id IS NULL
          ) AS "unpricedCount"
        FROM (SELECT DISTINCT deck_id FROM priced) decks
        LEFT JOIN per_printing ON per_printing.deck_id = decks.deck_id
        GROUP BY decks.deck_id
      `.execute(db);

      return new Map(
        rows.rows.map((row) => [
          row.deckId,
          { totalValueCents: row.totalValueCents, unpricedCount: row.unpricedCount },
        ]),
      );
    },

    /**
     * Order matters: `mv_latest_printing_prices` is defined over
     * `mv_daily_printing_prices`, so refreshing it reads whatever the daily
     * view currently holds. Daily first, or the latest view republishes
     * yesterday's data under today's content token.
     */
    async refreshLatestPrices(): Promise<void> {
      await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_printing_prices`.execute(db);
      await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_printing_prices`.execute(db);
    },
  };
}
