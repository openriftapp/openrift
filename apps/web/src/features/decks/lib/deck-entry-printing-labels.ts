import type { VariantLabelEnumLabels } from "@openrift/shared/printing-label";
import { formatPrintingVariantLabelParts } from "@openrift/shared/printing-label";
import type { Printing } from "@openrift/shared/types/catalog";

import { distinctPrintingCode } from "@/features/cards/lib/printing-search-link";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { getDeckCardKey } from "@/features/decks/lib/deck-builder-card";

export function entryPrintingLabels(
  entries: readonly DeckBuilderCard[],
  resolvePrinting: (cardId: string, preferredPrintingId: string | null) => Printing | undefined,
  labels: VariantLabelEnumLabels,
  standardLabel: string,
  defaultLabel: string,
): Map<string, string> {
  const result = new Map<string, string>();
  const groups = Map.groupBy(entries, (entry) => `${entry.cardId}|${entry.zone}`);
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    const resolved = group.map((entry) => ({
      entry,
      printing: resolvePrinting(entry.cardId, entry.preferredPrintingId),
    }));
    const siblings = resolved.flatMap(({ printing }) => (printing ? [printing] : []));
    const codesDiffer =
      new Set(siblings.map((printing) => distinctPrintingCode(printing))).size > 1;
    for (const { entry, printing } of resolved) {
      if (entry.preferredPrintingId === null) {
        result.set(getDeckCardKey(entry), defaultLabel);
        continue;
      }
      if (!printing) {
        continue;
      }
      const { language, rest } = formatPrintingVariantLabelParts(printing, siblings, labels);
      const parts = [
        ...(codesDiffer ? [distinctPrintingCode(printing)] : []),
        ...(language ? [language] : []),
        ...rest,
      ];
      result.set(getDeckCardKey(entry), parts.length > 0 ? parts.join(" · ") : standardLabel);
    }
  }
  return result;
}
