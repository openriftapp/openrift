import { groupPrintingsByLanguage } from "@/features/admin/lib/printings-by-language";
import { useLanguages } from "@/hooks/use-languages";

export function usePrintingsByLanguage<T extends { language: string }>(
  printings: readonly T[],
): [string, T[]][] {
  const { data } = useLanguages();
  return groupPrintingsByLanguage(
    printings,
    data.languages.map((language) => language.code),
  );
}
