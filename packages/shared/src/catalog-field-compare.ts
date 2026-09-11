import type { AcceptCardField, AcceptPrintingField } from "./contracts/admin/card-mutations.js";

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

/** Fields the proposal has a value for that differ from the live value. */
export function differingFields(
  fields: readonly string[],
  live: object,
  proposed: object,
): string[] {
  const liveValues = live as Record<string, unknown>;
  const proposedValues = proposed as Record<string, unknown>;
  return fields.filter(
    (field) =>
      hasFieldValue(proposedValues[field]) &&
      !sameFieldValue(liveValues[field] ?? null, proposedValues[field], field),
  );
}
