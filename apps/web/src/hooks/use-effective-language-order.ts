import { useLanguageList } from "@/hooks/use-enums";
import { useDisplayStore } from "@/stores/display-store";

/** Pair with `canonicalRank` to sort printings for both authenticated and logged-out users. */
export function useEffectiveLanguageOrder(): readonly string[] {
  const userLanguages = useDisplayStore((s) => s.languages);
  const defaultLanguages = useLanguageList().map((l) => l.code);
  return userLanguages.length > 0 ? userLanguages : defaultLanguages;
}
