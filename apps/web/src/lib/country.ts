import { FLAG_CODES } from "@/lib/flag-codes";
import { getLocale } from "@/paraglide/runtime.js";

const ALPHA_2 = /^[a-z]{2}$/u;

const regionNames = new Map<string, Intl.DisplayNames>();

function regionNamesForLocale(): Intl.DisplayNames {
  const locale = getLocale();
  let names = regionNames.get(locale);
  if (names === undefined) {
    names = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
    regionNames.set(locale, names);
  }
  return names;
}

export function normalizeCountryCode(code: string | null | undefined): string | null {
  if (code === null || code === undefined) {
    return null;
  }
  const lower = code.trim().toLowerCase();
  return ALPHA_2.test(lower) ? lower : null;
}

export function countryName(code: string | null | undefined): string | null {
  const lower = normalizeCountryCode(code);
  if (lower === null) {
    return null;
  }
  // ZZ is CLDR's "Unknown Region": a real entry, but not a country to print.
  if (lower === "zz") {
    return null;
  }
  return regionNamesForLocale().of(lower.toUpperCase()) ?? null;
}

export function flagIconPath(code: string | null | undefined): string | null {
  const lower = normalizeCountryCode(code);
  if (lower === null || !FLAG_CODES.has(lower)) {
    return null;
  }
  return `/images/flags/${lower}.webp`;
}

export function countryLabel(code: string | null | undefined): string | null {
  const lower = normalizeCountryCode(code);
  if (lower === null) {
    return null;
  }
  return countryName(lower) ?? lower.toUpperCase();
}
