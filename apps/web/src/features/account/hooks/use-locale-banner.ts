import type { LocaleBannerDecision } from "@/features/account/lib/locale-banner";
import { localeBannerDecision } from "@/features/account/lib/locale-banner";
import { useLocaleBannerStore } from "@/features/account/stores/locale-banner-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { hasLocaleCookie } from "@/lib/locale-entry";
import { getLocale } from "@/paraglide/runtime.js";

export function useLocaleBanner(): LocaleBannerDecision {
  const hydrated = useHydrated();
  const dismissed = useLocaleBannerStore((state) => state.dismissed);
  if (!hydrated) {
    return { kind: "hide" };
  }
  return localeBannerDecision({
    active: getLocale(),
    hasCookie: hasLocaleCookie(document.cookie),
    browserTags: navigator.languages ?? [],
    dismissed,
  });
}
