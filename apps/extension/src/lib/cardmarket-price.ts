export type PriceVerdict = "below" | "near" | "above";

const NEAR_BAND = 0.2;

const DIGITS = /[\d.,]+/u;

/**
 * Cardmarket prints prices in the interface language: "1,00 €" in German,
 * "€1.00" in English, "1.234,56 €" once a card is expensive.
 */
export function parsePriceCents(text: string): number | undefined {
  const match = DIGITS.exec(text.replaceAll(/\s/gu, ""));
  if (match === null) {
    return undefined;
  }
  const raw = match[0];
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const separator = Math.max(lastComma, lastDot);
  const decimals = separator === -1 ? 0 : raw.length - separator - 1;

  // A separator with anything but two digits behind it groups thousands.
  const isDecimal = separator !== -1 && (decimals === 1 || decimals === 2);
  const digits = raw.replaceAll(/[.,]/gu, "");
  if (!/^\d+$/u.test(digits)) {
    return undefined;
  }
  const value = Math.trunc(Number(digits));
  if (!isDecimal) {
    return value * 100;
  }
  return decimals === 1 ? value * 10 : value;
}

export function priceVerdict(
  sellerCents: number,
  referenceCents: number,
): PriceVerdict | undefined {
  if (referenceCents <= 0) {
    return undefined;
  }
  if (sellerCents <= referenceCents) {
    return "below";
  }
  return sellerCents <= referenceCents * (1 + NEAR_BAND) ? "near" : "above";
}
