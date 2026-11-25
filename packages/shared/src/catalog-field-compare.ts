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
  "releasedAt",
  "releasePrecision",
  "announcedAt",
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

/** A dismissal holds for the value it was made on; a source that reports another value is heard again. */
export function isDismissedValue(
  dismissed: Readonly<Record<string, unknown>> | undefined,
  field: string,
  value: unknown,
): boolean {
  return (
    dismissed !== undefined &&
    Object.hasOwn(dismissed, field) &&
    sameFieldValue(dismissed[field], value, field)
  );
}

export function differingFields<K extends string>(
  fields: readonly K[],
  live: Readonly<Record<K, unknown>>,
  proposed: Readonly<Record<K, unknown>>,
  dismissed?: Readonly<Record<string, unknown>>,
): K[] {
  return fields.filter(
    (field) =>
      hasFieldValue(proposed[field]) &&
      !sameFieldValue(live[field] ?? null, proposed[field], field) &&
      !isDismissedValue(dismissed, field, proposed[field]),
  );
}
