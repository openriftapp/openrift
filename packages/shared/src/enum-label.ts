import { foldForSearch } from "./search-fold.js";

declare const labelMapBrand: unique symbol;

/** Opaque so a label map can only be read through `enumLabel`, the one place a missing label falls back to the slug. */
export interface LabelMap {
  readonly [labelMapBrand]: true;
}

type LabelRows = readonly { slug: string; label: string }[];

function asRecord(map: LabelMap): Readonly<Record<string, string>> {
  return map as unknown as Readonly<Record<string, string>>;
}

export function labelMap(rows: LabelRows): LabelMap {
  return Object.fromEntries(rows.map((row) => [row.slug, row.label])) as unknown as LabelMap;
}

export function labelMapOf(record: Readonly<Record<string, string>>): LabelMap {
  return { ...record } as unknown as LabelMap;
}

export function mergeLabelMaps(...maps: readonly LabelMap[]): LabelMap {
  return Object.assign({}, ...maps.map((map) => asRecord(map))) as LabelMap;
}

export function enumLabel(map: LabelMap, slug: string): string {
  return asRecord(map)[slug] ?? slug;
}

export function slugForLabel(map: LabelMap, text: string): string | undefined {
  const wanted = foldForSearch(text);
  if (wanted === "") {
    return undefined;
  }
  for (const [slug, label] of Object.entries(asRecord(map))) {
    if (foldForSearch(slug) === wanted || foldForSearch(label) === wanted) {
      return slug;
    }
  }
  return undefined;
}

export interface InitEnumLabels {
  cardTypes: LabelMap;
  superTypes: LabelMap;
  domains: LabelMap;
  deckZones: LabelMap;
  artVariants: LabelMap;
  finishes: LabelMap;
  cardSizes: LabelMap;
  languages: LabelMap;
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
    languages: labelMap(enums.languages),
  };
}
