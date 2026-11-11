import type { Sql } from "postgres";

// Migrations create the views before seed data exists, so a seeded test database
// needs every view refreshed. Daily prices before latest: latest reads daily.
export async function refreshSeedMaterializedViews(sql: Sql): Promise<void> {
  await sql`REFRESH MATERIALIZED VIEW mv_card_aggregates`;
  await sql`REFRESH MATERIALIZED VIEW mv_daily_printing_prices`;
  await sql`REFRESH MATERIALIZED VIEW mv_latest_printing_prices`;
  await sql`REFRESH MATERIALIZED VIEW mv_printing_sides_canonical_rank`;
  await sql`REFRESH MATERIALIZED VIEW mv_printing_foil_twins`;
}
