import type { Currency } from "@openrift/shared/types/api/trade-preferences";
import { CURRENCIES } from "@openrift/shared/types/api/trade-preferences";

import { m } from "@/paraglide/messages.js";

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function currencySelectItems(): { value: Currency; label: string }[] {
  return CURRENCIES.map((value) => ({
    value,
    label: value === "EUR" ? m.profile_trading_currency_eur() : m.profile_trading_currency_usd(),
  }));
}
