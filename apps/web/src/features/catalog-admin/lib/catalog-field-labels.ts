import type {
  AcceptCardField,
  AcceptPrintingField,
} from "@openrift/shared/contracts/admin/card-mutations";

export const COMPARABLE_CARD_FIELDS = [
  "name",
  "types",
  "superTypes",
  "domains",
  "might",
  "energy",
  "power",
  "mightBonus",
  "tags",
] as const satisfies readonly AcceptCardField[];

export const COMPARABLE_PRINTING_FIELDS = [
  "shortCode",
  "setId",
  "rarity",
  "artVariant",
  "isSigned",
  "isOvernumbered",
  "markerSlugs",
  "distributionChannelSlugs",
  "finish",
  "size",
  "artist",
  "publicCode",
  "printedRulesText",
  "printedEffectText",
  "flavorText",
  "language",
  "printedName",
  "printedYear",
] as const satisfies readonly AcceptPrintingField[];

export type ComparableCardField = (typeof COMPARABLE_CARD_FIELDS)[number];
export type ComparablePrintingField = (typeof COMPARABLE_PRINTING_FIELDS)[number];

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

export function hasFieldValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

// Marker and channel slugs are sets on the wire; every other list field
// (types, supertypes, domains, tags) is ordered and a reorder is a real change.
const UNORDERED_LIST_FIELDS: ReadonlySet<string> = new Set([
  "markerSlugs",
  "distributionChannelSlugs",
]);

export function sameFieldValue(a: unknown, b: unknown, field?: string): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    let left = Array.isArray(a) ? a.map(String) : [];
    let right = Array.isArray(b) ? b.map(String) : [];
    if (field !== undefined && UNORDERED_LIST_FIELDS.has(field)) {
      left = left.toSorted();
      right = right.toSorted();
    }
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
  const left = hasFieldValue(a) ? String(a) : "";
  const right = hasFieldValue(b) ? String(b) : "";
  return left === right;
}

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
