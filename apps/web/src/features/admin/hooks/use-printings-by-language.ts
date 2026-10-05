import { useLanguages } from "@/features/admin/hooks/use-languages";
import type { PrintingLanguageGroup } from "@/features/cards/lib/printing-languages";
import { groupPrintingsByLanguage } from "@/features/cards/lib/printing-languages";

export function usePrintingsByLanguage<T extends { language: string }>(
  printings: readonly T[],
): PrintingLanguageGroup<T>[] {
  const { data } = useLanguages();
  return groupPrintingsByLanguage(
    printings,
    data.languages.map((language) => language.code),
  );
}
