import type { AnySnapshot } from "@openrift/shared/types/api/pricing";
import type { Marketplace } from "@openrift/shared/types/pricing";

export interface PriceHistoryPoint {
  date: string;
  value: number | null;
  secondary: number | null;
}

// CardTrader's `zeroLow` is null on days before Zero prices existed; falling back to `low` there would plot a false drop.
export function priceHistoryPoint(
  marketplace: Marketplace,
  snapshot: AnySnapshot,
): PriceHistoryPoint {
  if ("zeroLow" in snapshot) {
    return { date: snapshot.date, value: snapshot.zeroLow, secondary: snapshot.low };
  }
  if ("market" in snapshot) {
    return marketplace === "cardmarket"
      ? { date: snapshot.date, value: snapshot.low ?? snapshot.market, secondary: snapshot.market }
      : { date: snapshot.date, value: snapshot.market, secondary: snapshot.low };
  }
  return { date: snapshot.date, value: snapshot.low, secondary: null };
}
