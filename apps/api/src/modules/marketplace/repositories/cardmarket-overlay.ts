import type { ListKind } from "@openrift/shared/types/api/list";
import type { Marketplace } from "@openrift/shared/types/pricing";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

export interface CardmarketOverlayListRow {
  id: string;
  name: string;
  kind: ListKind;
}

/** One resolved want: a card target or a printing target, never both. */
export interface CardmarketOverlayWant {
  cardId: string | null;
  printingId: string | null;
  quantity: number;
}

export interface CardmarketOverlayCountRow {
  idProduct: number;
  finish: "normal" | "foil";
  owned: number;
  wanted: number;
  priceCents: number | null;
}

const CARDMARKET: Marketplace = "cardmarket";

export function cardmarketOverlayRepo(db: Kysely<Database>) {
  return {
    wishListsForUser(listIds: string[], userId: string): Promise<CardmarketOverlayListRow[]> {
      return db
        .selectFrom("lists")
        .select(["id", "name", "kind"])
        .where("id", "in", listIds)
        .where("userId", "=", userId)
        .where("intent", "=", "wish")
        .orderBy("name")
        .orderBy("id")
        .execute();
    },

    /**
     * `wants` arrives already rule-expanded. Every part keys on (external_id, finish);
     * the DISTINCT dedupes one want across the several printings a product row fronts.
     */
    async productCounts(
      wants: CardmarketOverlayWant[],
      userId: string,
      marketplace: Marketplace,
    ): Promise<CardmarketOverlayCountRow[]> {
      const wantIds = wants.map((_, index) => index);
      const cardIds = wants.map((want) => want.cardId);
      const printingIds = wants.map((want) => want.printingId);
      const quantities = wants.map((want) => want.quantity);
      const result = await sql<CardmarketOverlayCountRow>`
        WITH resolved AS (
          SELECT * FROM unnest(
            ${wantIds}::int[],
            ${cardIds}::uuid[],
            ${printingIds}::uuid[],
            ${quantities}::int[]
          ) AS t(want_id, card_id, printing_id, quantity)
        ),
        want_printings AS (
          SELECT r.want_id, r.quantity, r.printing_id
          FROM resolved r
          WHERE r.printing_id IS NOT NULL
          UNION ALL
          SELECT r.want_id, r.quantity, pr.id
          FROM resolved r
          JOIN printings pr ON pr.card_id = r.card_id
          WHERE r.card_id IS NOT NULL
        ),
        wanted AS (
          SELECT external_id, finish, SUM(quantity)::int AS wanted
          FROM (
            SELECT DISTINCT wp.want_id, wp.quantity, p.external_id, p.finish
            FROM want_printings wp
            JOIN marketplace_product_variants v ON v.printing_id = wp.printing_id
            JOIN marketplace_products p ON p.id = v.marketplace_product_id
            WHERE p.marketplace = ${CARDMARKET} AND p.finish IN ('normal', 'foil')
          ) per_want
          GROUP BY external_id, finish
        ),
        owned AS (
          SELECT p.external_id, p.finish, COUNT(DISTINCT c.id)::int AS owned
          FROM copies c
          JOIN collections col ON col.id = c.collection_id
          JOIN marketplace_product_variants v ON v.printing_id = c.printing_id
          JOIN marketplace_products p ON p.id = v.marketplace_product_id
          WHERE p.marketplace = ${CARDMARKET}
            AND p.finish IN ('normal', 'foil')
            AND col.user_id = ${userId}
          GROUP BY p.external_id, p.finish
        ),
        priced AS (
          SELECT
            p.external_id,
            p.finish,
            COALESCE(
              MIN(mvp.headline_cents) FILTER (WHERE pr.language = 'EN'),
              MIN(mvp.headline_cents)
            )::int AS price_cents
          FROM marketplace_products p
          JOIN marketplace_product_variants v ON v.marketplace_product_id = p.id
          JOIN printings pr ON pr.id = v.printing_id
          JOIN mv_latest_printing_prices mvp
            ON mvp.printing_id = pr.id AND mvp.marketplace = ${marketplace}
          WHERE p.marketplace = ${CARDMARKET} AND p.finish IN ('normal', 'foil')
          GROUP BY p.external_id, p.finish
        ),
        keys AS (
          SELECT external_id, finish FROM owned
          UNION
          SELECT external_id, finish FROM wanted
          UNION
          SELECT external_id, finish FROM priced
        )
        SELECT
          k.external_id AS "idProduct",
          k.finish AS finish,
          COALESCE(o.owned, 0) AS owned,
          COALESCE(w.wanted, 0) AS wanted,
          z.price_cents AS "priceCents"
        FROM keys k
        LEFT JOIN owned o ON o.external_id = k.external_id AND o.finish = k.finish
        LEFT JOIN wanted w ON w.external_id = k.external_id AND w.finish = k.finish
        LEFT JOIN priced z ON z.external_id = k.external_id AND z.finish = k.finish
        ORDER BY 1, 2
      `.execute(db);
      return result.rows;
    },
  };
}
