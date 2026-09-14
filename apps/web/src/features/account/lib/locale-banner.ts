import { localeFromLanguageTags } from "@/lib/locale-entry";
import type { Locale } from "@/paraglide/runtime.js";

export type LocaleBannerDecision =
  | { kind: "hide" }
  | { kind: "suggest"; locale: Locale }
  | { kind: "notice"; locale: Locale };

/**
 * A browser whose first supported language is not English is switched on its
 * own, so "suggest" only covers a supported language listed after English.
 */
export function localeBannerDecision({
  active,
  hasCookie,
  browserTags,
  dismissed,
}: {
  active: Locale;
  hasCookie: boolean;
  browserTags: readonly string[];
  dismissed: boolean;
}): LocaleBannerDecision {
  if (dismissed) {
    return { kind: "hide" };
  }
  if (active !== "en") {
    return { kind: "notice", locale: active };
  }
  if (hasCookie || localeFromLanguageTags(browserTags) !== "en") {
    return { kind: "hide" };
  }
  for (const tag of browserTags) {
    const locale = localeFromLanguageTags([tag]);
    if (locale !== undefined && locale !== "en") {
      return { kind: "suggest", locale };
    }
  }
  return { kind: "hide" };
}
