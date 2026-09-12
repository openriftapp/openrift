import type {
  Currency,
  TradePricePref,
  TradeType,
} from "@openrift/shared/types/api/trade-preferences";

import { m } from "@/paraglide/messages.js";

export function pricePrefLabel(pref: TradePricePref): string {
  switch (pref) {
    case "cm_lowest": {
      return m.trade_pref_price_cm_lowest();
    }
    case "tcg_lowest": {
      return m.trade_pref_price_tcg_lowest();
    }
    case "ct_zero": {
      return m.trade_pref_price_ct_zero();
    }
    case "absolute": {
      return m.trade_pref_price_fixed();
    }
  }
}

export function pricePrefShortLabel(pref: TradePricePref): string {
  switch (pref) {
    case "cm_lowest": {
      return "Cardmarket";
    }
    case "tcg_lowest": {
      return "TCGplayer";
    }
    case "ct_zero": {
      return "CardTrader";
    }
    case "absolute": {
      return m.trade_pref_price_fixed();
    }
  }
}

// `absolute` is deliberately empty: that branch renders the formatted price instead.
export const PRICE_PREF_ABBR: Record<TradePricePref, string> = {
  cm_lowest: "CM",
  tcg_lowest: "TCG",
  ct_zero: "CT",
  absolute: "",
};

export function tradeTypeLabel(type: TradeType): string {
  switch (type) {
    case "cards": {
      return m.trade_pref_type_cards();
    }
    case "money": {
      return m.trade_pref_type_money();
    }
    case "both": {
      return m.trade_pref_type_both();
    }
  }
}

export function tradeTypeShortLabel(type: TradeType): string {
  switch (type) {
    case "cards": {
      return m.trade_pref_type_cards();
    }
    case "money": {
      return m.trade_pref_type_money();
    }
    case "both": {
      return m.trade_pref_type_both_short();
    }
  }
}

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
};

export function formatAbsolutePrice(
  cents: number | null,
  currency: Currency | null,
): string | null {
  if (cents === null || currency === null) {
    return null;
  }
  const whole = Math.trunc(cents / 100);
  const remainder = cents % 100;
  return `${whole}.${String(remainder).padStart(2, "0")} ${currency}`;
}
