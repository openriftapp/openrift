import { labelMap } from "./collections.js";

export function enumLabel(map: Record<string, string>, slug: string): string {
  return map[slug] ?? slug;
}

type LabelRows = readonly { slug: string; label: string }[];

export interface InitEnumLabels {
  cardTypes: Record<string, string>;
  superTypes: Record<string, string>;
  domains: Record<string, string>;
  deckZones: Record<string, string>;
  artVariants: Record<string, string>;
  finishes: Record<string, string>;
  cardSizes: Record<string, string>;
}

export function enumLabelsFromInit(enums: {
  [Key in keyof InitEnumLabels]: LabelRows;
}): InitEnumLabels {
  return {
    cardTypes: labelMap(enums.cardTypes),
    superTypes: labelMap(enums.superTypes),
    domains: labelMap(enums.domains),
    deckZones: labelMap(enums.deckZones),
    artVariants: labelMap(enums.artVariants),
    finishes: labelMap(enums.finishes),
    cardSizes: labelMap(enums.cardSizes),
  };
}
