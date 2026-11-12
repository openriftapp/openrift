import type { CardStatLabels } from "@openrift/shared/card-stat-line";
import type { LabelMap } from "@openrift/shared/enum-label";
import type { VariantLabelEnumLabels } from "@openrift/shared/printing-label";

export interface EnumLabels extends VariantLabelEnumLabels, CardStatLabels {
  rarities: LabelMap;
  conditions: LabelMap;
  graders: LabelMap;
}
