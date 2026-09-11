import type { DisplayLocale } from "@openrift/shared/types/api/preferences";
import { DISPLAY_LOCALES } from "@openrift/shared/types/api/preferences";

/** Endonyms, so a reader who cannot read the active locale still finds theirs. */
export const DISPLAY_LOCALE_LABELS: Record<DisplayLocale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
};

export function isDisplayLocale(value: unknown): value is DisplayLocale {
  return typeof value === "string" && (DISPLAY_LOCALES as readonly string[]).includes(value);
}
