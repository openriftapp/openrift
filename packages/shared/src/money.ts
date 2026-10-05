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

// Locale fixed to `en`: server-rendered and browser-rendered output must match.
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
}
