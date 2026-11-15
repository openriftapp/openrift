import { useDisplayLanguages } from "@/hooks/use-display-languages";
import { useLanguageList } from "@/hooks/use-enums";

/** Pair with `canonicalRank` to sort printings for both authenticated and logged-out users. */
export function useEffectiveLanguageOrder(): readonly string[] {
  const userLanguages = useDisplayLanguages();
  const defaultLanguages = useLanguageList().map((l) => l.code);
  return userLanguages.length > 0 ? userLanguages : defaultLanguages;
}
