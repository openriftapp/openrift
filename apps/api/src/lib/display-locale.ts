import { DISPLAY_LOCALES } from "@openrift/shared/types/api/preferences";
import type { DisplayLocale } from "@openrift/shared/types/api/preferences";

export function resolveDisplayLocale(value: unknown): DisplayLocale {
  return typeof value === "string" && DISPLAY_LOCALES.includes(value as DisplayLocale)
    ? (value as DisplayLocale)
    : "en";
}

/** Paraglide's default cookie name; `paraglide.config.ts` does not override `cookieName`. */
const LOCALE_COOKIE = "PARAGLIDE_LOCALE";

export function displayLocaleFromRequest(request?: Request): DisplayLocale | undefined {
  const cookie = request?.headers.get("cookie");
  if (!cookie) {
    return undefined;
  }
  const match = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`, "u").exec(cookie);
  if (match === null) {
    return undefined;
  }
  const value = decodeURIComponent(match[1] ?? "");
  return DISPLAY_LOCALES.includes(value as DisplayLocale) ? (value as DisplayLocale) : undefined;
}
