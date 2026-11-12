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
): ScanLanguageItem[] {
  return [
    { value: ANY_LANGUAGE, label: m.scan_language_any() },
    ...[...new Set([...printings.map((printing) => printing.language), selected ?? "EN"])]
      .toSorted()
      .map((code) => ({ value: code, label: enumLabel(labels, code) })),
  ];
}
