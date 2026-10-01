import type { AnySnapshot } from "@openrift/shared/types/api/pricing";

export interface PriceHistoryPoint {
  date: string;
  value: number | null;
  low: number | null;
}

// CardTrader's `zeroLow` is null on days before Zero prices existed; falling back to `low` there would plot a false drop.
export function priceHistoryPoint(snapshot: AnySnapshot): PriceHistoryPoint {
  if ("market" in snapshot) {
    return { date: snapshot.date, value: snapshot.market, low: snapshot.low };
  }
  if ("zeroLow" in snapshot) {
    return { date: snapshot.date, value: snapshot.zeroLow, low: snapshot.low };
  }
  return { date: snapshot.date, value: snapshot.low, low: null };
}
