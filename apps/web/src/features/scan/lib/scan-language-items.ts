import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import type { Printing } from "@openrift/shared/types/catalog";

import { m } from "@/paraglide/messages.js";

export const ANY_LANGUAGE = "any";

export interface ScanLanguageItem {
  value: string;
  label: string;
}

// Includes the selected language even if no printing currently has it, so it stays selectable.
export function scanLanguageItems(
  printings: Printing[],
  selected: string | null,
  labels: LabelMap,
  languageOrder: readonly string[],
): ScanLanguageItem[] {
  const codes = [...new Set([...printings.map((printing) => printing.language), selected ?? "EN"])];
  const rank = (code: string) => {
    const index = languageOrder.indexOf(code);
    return index === -1 ? languageOrder.length : index;
  };
  return [
    { value: ANY_LANGUAGE, label: m.scan_language_any() },
    ...codes
      .toSorted((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      .map((code) => ({ value: code, label: enumLabel(labels, code) })),
  ];
}
