import type { Marketplace } from "./types/pricing.js";

interface PriceColumnValues {
  market?: number | null;
  low?: number | null;
  zeroLow?: number | null;
}

/** Must stay equal to the CASE in `mv_daily_printing_prices`. */
export function headlinePrice(marketplace: Marketplace, row: PriceColumnValues): number | null {
  if (marketplace === "cardtrader") {
    return row.zeroLow ?? row.low ?? null;
  }
  if (marketplace === "cardmarket") {
    return row.low ?? row.market ?? null;
  }
  return row.market ?? row.low ?? null;
}

export function headlineColumn(marketplace: Marketplace): "market" | "low" | "zeroLow" {
  if (marketplace === "cardtrader") {
    return "zeroLow";
  }
  return marketplace === "tcgplayer" ? "market" : "low";
}
