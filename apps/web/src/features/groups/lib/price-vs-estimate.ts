import type { EffectiveTradePreference } from "@openrift/shared/types/api/trade-preferences";
import { MARKETPLACE_CURRENCY } from "@openrift/shared/types/pricing";

import type { MatchDirection } from "./trade-derivation";

const MATCH_TOLERANCE = 0.05;

export interface PriceVsEstimate {
  kind: "match" | "above" | "below";
  difference: number;
  favorable: boolean;
}

export function fixedPriceVsEstimate(
  pref: EffectiveTradePreference,
  estimate: number | undefined,
  direction: MatchDirection,
): PriceVsEstimate | null {
  if (
    pref.pricePref !== "absolute" ||
    pref.priceAbsoluteCents === null ||
    pref.currency !== MARKETPLACE_CURRENCY.cardtrader ||
    estimate === undefined ||
    estimate <= 0
  ) {
    return null;
  }
  const difference = pref.priceAbsoluteCents / 100 - estimate;
  if (Math.abs(difference) <= estimate * MATCH_TOLERANCE) {
    return { kind: "match", difference: 0, favorable: true };
  }
  const above = difference > 0;
  return {
    kind: above ? "above" : "below",
    difference: Math.abs(difference),
    favorable: direction === "outgoing" ? above : !above,
  };
}
