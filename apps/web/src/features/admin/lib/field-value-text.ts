import { hasFieldValue } from "@openrift/shared/catalog-field-compare";
import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatDay } from "@openrift/shared/format-date";
import { formatPrintingCode } from "@openrift/shared/printing-code";

export const EMPTY_VALUE_TEXT = "—";

export interface PrintingValueLabels {
  rarities: LabelMap;
  finishes: LabelMap;
  artVariants: LabelMap;
  cardSizes: LabelMap;
  languages: LabelMap;
  markers: LabelMap;
  channels: LabelMap;
}

interface CatalogValueLabels extends Partial<PrintingValueLabels> {
  cardTypes?: LabelMap;
  superTypes?: LabelMap;
  domains?: LabelMap;
}

const LABEL_GROUPS: Partial<Record<string, keyof CatalogValueLabels>> = {
  rarity: "rarities",
  finish: "finishes",
  artVariant: "artVariants",
  size: "cardSizes",
  language: "languages",
  markerSlugs: "markers",
  distributionChannelSlugs: "channels",
  types: "cardTypes",
  superTypes: "superTypes",
  domains: "domains",
};

const DAY_FIELDS: ReadonlySet<string> = new Set(["releasedAt", "announcedAt"]);

function scalarText(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

export function formatFieldValue(value: unknown, label?: (entry: string) => string): string {
  if (!hasFieldValue(value)) {
    return EMPTY_VALUE_TEXT;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => (label ? label(String(entry)) : scalarText(entry))).join(", ");
  }
  if (label && (typeof value === "string" || typeof value === "number")) {
    return label(String(value));
  }
  return scalarText(value);
}

export function formatCatalogFieldValue(
  field: string,
  value: unknown,
  labels?: CatalogValueLabels,
): string {
  if (DAY_FIELDS.has(field) && typeof value === "string" && value !== "") {
    return formatDay(value) || value;
  }
  if (field === "publicCode" && typeof value === "string" && value !== "") {
    return formatPrintingCode(value);
  }
  const group = LABEL_GROUPS[field];
  const map = group === undefined ? undefined : labels?.[group];
  return formatFieldValue(value, map ? (entry) => enumLabel(map, entry) : undefined);
}

export function formatRawValue(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}
