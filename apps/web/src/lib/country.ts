import type { CountryNames } from "@/lib/country-names/loaders.gen";
import { COUNTRY_NAME_LOADERS } from "@/lib/country-names/loaders.gen";
import { FLAG_CODES } from "@/lib/flag-codes";
import type { Locale } from "@/paraglide/runtime.js";
import { getLocale, locales } from "@/paraglide/runtime.js";

const ALPHA_2 = /^[a-z]{2}$/u;

// Every locale switch reloads the document, so the browser loads only the
// locale it started in. Importers wait for this await: keep them in lazy chunks.
const NAMES: Partial<Record<Locale, CountryNames>> = Object.fromEntries(
  await Promise.all(
    (import.meta.env.SSR ? locales : [getLocale()]).map(async (locale) => {
      const { default: names } = await COUNTRY_NAME_LOADERS[locale]();
      return [locale, names];
    }),
  ),
);

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
  return NAMES[getLocale()]?.[lower] ?? null;
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
