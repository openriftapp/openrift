import { enumLabel } from "@openrift/shared/enum-label";
import { WellKnown } from "@openrift/shared/well-known";

import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";

interface VariantRow {
  markerSlugs: readonly string[];
  artVariant?: string;
  isSigned?: boolean;
  isOvernumbered?: boolean;
  size?: string;
}

export function variantExtras(row: VariantRow, labels: PrintingValueLabels): string[] {
  return [
    ...row.markerSlugs.map((slug) => enumLabel(labels.markers, slug)),
    row.artVariant !== undefined && row.artVariant !== WellKnown.artVariant.NORMAL
      ? enumLabel(labels.artVariants, row.artVariant)
      : null,
    row.isSigned === true ? "Signed" : null,
    row.isOvernumbered === true ? "Overnumbered" : null,
    row.size !== undefined && row.size !== WellKnown.cardSize.STANDARD
      ? enumLabel(labels.cardSizes, row.size)
      : null,
  ].filter((part) => part !== null);
}
