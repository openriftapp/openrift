import { formatPrintingVariantLabelParts } from "@openrift/shared/printing-label";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { EUR_MARKETPLACES } from "@openrift/shared/types/pricing";
import { WellKnown } from "@openrift/shared/well-known";

import type { EnumLabels } from "@/lib/enum-labels";
import { getLocale } from "@/paraglide/runtime.js";

export function formatCardId(printing: Printing): string {
  return printing.shortCode;
}

export interface ImportPrintingLabelParts {
  code: string;
  language: string | null;
  rest: string[];
}

export function formatImportPrintingLabelParts(
  printing: Printing,
  labels: EnumLabels,
): ImportPrintingLabelParts {
  const { rest } = formatPrintingVariantLabelParts(printing, undefined, labels);
  return {
    code: formatCardId(printing),
    language: printing.language === WellKnown.language.EN ? null : printing.language,
    rest,
  };
}

/** For display, prefer the `ImportPrintingLabel` component, which renders the language as a chip. */
export function formatImportPrintingLabel(printing: Printing, labels: EnumLabels): string {
  const { code, language, rest } = formatImportPrintingLabelParts(printing, labels);
  const parts = [code];
  if (language) {
    parts.push(`[${language}]`);
  }
  if (rest.length > 0) {
    parts.push(rest.join(" · "));
  }
  return parts.join(" · ");
}

export function formatPublicCode(printing: Printing): string {
  return printing.publicCode;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = getLocale();
  const cacheKey = `${locale}:${key}`;
  let format = numberFormats.get(cacheKey);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(cacheKey, format);
  }
  return format;
}

export function formatCount(value: number): string {
  return numberFormat("count", {}).format(value);
}

type Currency = "USD" | "EUR";

function currencyFormat(currency: Currency, fractionDigits: number): Intl.NumberFormat {
  return numberFormat(`${currency}:${fractionDigits}`, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatMoney(value: number, currency: Currency): string {
  return currencyFormat(currency, 2).format(value);
}

function formatMoneyCompact(value: number, currency: Currency): string {
  if (value < 10) {
    return formatMoney(value, currency);
  }
  const rounded = Math.round(value);
  if (rounded < 1000) {
    return currencyFormat(currency, 0).format(rounded);
  }
  const thousands = rounded / 1000;
  const fractionDigits = Math.round(thousands * 10) < 100 ? 1 : 0;
  const parts = currencyFormat(currency, fractionDigits).formatToParts(thousands);
  const lastNumeral = parts.findLastIndex(
    (part) => part.type === "integer" || part.type === "fraction",
  );
  return parts
    .map((part, index) => (index === lastNumeral ? `${part.value}k` : part.value))
    .join("");
}

export function formatPrice(value?: number | null): string {
  return value === null || value === undefined ? "--" : formatMoney(value, "USD");
}

export function priceColorClass(value?: number | null): string {
  if (value === null || value === undefined || value < 1) {
    return "text-muted-foreground";
  }
  if (value < 10) {
    return "text-success";
  }
  if (value < 50) {
    return "text-warning";
  }
  return "text-destructive";
}

export function formatPriceEur(value?: number | null): string {
  return value === null || value === undefined ? "--" : formatMoney(value, "EUR");
}

export function formatPriceCompact(value?: number | null): string {
  return value === null || value === undefined ? "--" : formatMoneyCompact(value, "USD");
}

function formatPriceCompactEur(value?: number | null): string {
  return value === null || value === undefined ? "--" : formatMoneyCompact(value, "EUR");
}

export function formatterForMarketplace(marketplace: Marketplace): (v?: number | null) => string {
  return EUR_MARKETPLACES.has(marketplace) ? formatPriceEur : formatPrice;
}

export function compactFormatterForMarketplace(
  marketplace: Marketplace,
): (v?: number | null) => string {
  return EUR_MARKETPLACES.has(marketplace) ? formatPriceCompactEur : formatPriceCompact;
}

export interface PriceChangeParts {
  sign: string;
  magnitude: number;
  percent: number | null;
}

/** Keeps sign separate from magnitude so a currency formatter doesn't print its own negative form. */
export function describePriceChange(value: number, baseline: number): PriceChangeParts {
  const delta = value - baseline;
  return {
    sign: delta < 0 ? "−" : "+",
    magnitude: Math.abs(delta),
    percent: baseline === 0 ? null : (delta / baseline) * 100,
  };
}
