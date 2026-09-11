import type {
  ComparableCardField,
  ComparablePrintingField,
} from "@openrift/shared/catalog-field-compare";
import { hasFieldValue } from "@openrift/shared/catalog-field-compare";

export const CARD_FIELD_LABELS: Record<ComparableCardField, string> = {
  name: "Name",
  types: "Types",
  superTypes: "Supertypes",
  domains: "Domains",
  might: "Might",
  energy: "Energy",
  power: "Power",
  mightBonus: "Might bonus",
  tags: "Tags",
};

export const PRINTING_FIELD_LABELS: Record<ComparablePrintingField, string> = {
  shortCode: "Short code",
  setId: "Set",
  rarity: "Rarity",
  artVariant: "Art variant",
  isSigned: "Signed",
  isOvernumbered: "Overnumbered",
  markerSlugs: "Markers",
  distributionChannelSlugs: "Distribution",
  finish: "Finish",
  size: "Size",
  artist: "Artist",
  publicCode: "Public code",
  printedRulesText: "Printed rules",
  printedEffectText: "Printed effect",
  flavorText: "Flavor text",
  language: "Language",
  printedName: "Printed name",
  printedYear: "Printed year",
};

export const DIFFED_FIELDS: ReadonlySet<string> = new Set([
  "rulesText",
  "effectText",
  "printedRulesText",
  "printedEffectText",
  "flavorText",
]);

export function formatFieldValue(value: unknown): string {
  if (!hasFieldValue(value)) {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}
