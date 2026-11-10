// 0 is treated as no data and returned as null, not 0 cents.
export function toCents(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined || amount === 0) {
    return null;
  }
  return Math.round(amount * 100);
}

export function centsToDollars<T extends number | null>(cents: T): T extends null ? null : number {
  return (cents === null ? null : cents / 100) as T extends null ? null : number;
}

export function moneyFormatOptions(currency: string, fractionDigits = 2): Intl.NumberFormatOptions {
  return {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  };
}

/** Pass the viewer's locale where one is known; output rendered on the server and in the browser must use the same one. */
export function formatCents(cents: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale, moneyFormatOptions(currency)).format(cents / 100);
}
