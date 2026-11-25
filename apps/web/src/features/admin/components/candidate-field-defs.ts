import { hasFieldValue } from "@openrift/shared/catalog-field-compare";
import type {
  AcceptCardField,
  AcceptPrintingField,
} from "@openrift/shared/contracts/admin/card-mutations";
import { enumLabel } from "@openrift/shared/enum-label";
import type { LabelMap } from "@openrift/shared/enum-label";
import type { EnumOrders } from "@openrift/shared/types/enums";

import {
  CARD_FIELD_LABELS,
  CARD_TEXT_FIELD_LABELS,
  PRINTING_FIELD_LABELS,
  SOURCE_COLUMN_LABELS,
} from "@/features/admin/lib/catalog-field-labels";
import { formatFieldValue } from "@/features/admin/lib/field-value-text";
import type { CardTextVariant } from "@/features/contribute/components/card-text-input";
import type { EnumLabels } from "@/lib/enum-labels";
import type { FilterCategory } from "@/lib/icons";
import { parseIntegerInput } from "@/lib/integer-input";

function toLabeledOptions(
  slugs: readonly string[],
  labels: LabelMap,
): { value: string; label: string }[] {
  return slugs.map((slug) => ({ value: slug, label: enumLabel(labels, slug) }));
}

export interface FieldDef<TKey extends string = string> {
  key: TKey;
  label: string;
  readOnly?: boolean;
  type?: "boolean" | "number";
  options?: readonly string[];
  labeledOptions?: readonly { value: string; label: string }[];
  suffixKey?: string;
  collapsible?: boolean;
  alwaysVisible?: boolean;
  multiline?: boolean;
  richText?: boolean;
  richTextVariant?: CardTextVariant;
  array?: boolean;
  suggestions?: readonly string[];
  iconCategory?: FilterCategory;
}

/** Every column the accept-field endpoint writes, plus the two read-only provider columns that are shown but never sent. */
export type CandidateCardFieldKey = AcceptCardField | "externalId" | "extraData";

export function candidateCardFieldDefs(
  orders: EnumOrders,
  labels: EnumLabels,
): FieldDef<CandidateCardFieldKey>[] {
  return [
    {
      key: "externalId",
      label: SOURCE_COLUMN_LABELS.externalId,
      readOnly: true,
      collapsible: true,
    },
    { key: "energy", label: CARD_FIELD_LABELS.energy, type: "number" },
    { key: "power", label: CARD_FIELD_LABELS.power, type: "number" },
    { key: "might", label: CARD_FIELD_LABELS.might, type: "number" },
    {
      key: "superTypes",
      label: CARD_FIELD_LABELS.superTypes,
      labeledOptions: toLabeledOptions(orders.superTypes, labels.superTypes),
      array: true,
    },
    {
      key: "types",
      label: CARD_FIELD_LABELS.types,
      labeledOptions: toLabeledOptions(orders.cardTypes, labels.cardTypes),
      array: true,
    },
    { key: "name", label: CARD_FIELD_LABELS.name },
    {
      key: "domains",
      label: CARD_FIELD_LABELS.domains,
      labeledOptions: toLabeledOptions(orders.domains, labels.domains),
      array: true,
    },
    { key: "mightBonus", label: CARD_FIELD_LABELS.mightBonus, type: "number" },
    { key: "tags", label: CARD_FIELD_LABELS.tags, array: true },
    { key: "maxCopiesOverride", label: CARD_FIELD_LABELS.maxCopiesOverride, type: "number" },
    {
      key: "additionalLegendCount",
      label: CARD_FIELD_LABELS.additionalLegendCount,
      type: "number",
    },
    { key: "comment", label: CARD_FIELD_LABELS.comment },
    { key: "extraData", label: SOURCE_COLUMN_LABELS.extraData, readOnly: true, collapsible: true },
  ];
}

// Not columns on `cards` (text lives on printedRulesText + errata); the accept
// endpoints reject them, so they appear only on the new-card page.
const NEW_CARD_TEXT_FIELDS: FieldDef<"rulesText" | "effectText">[] = [
  { key: "rulesText", label: CARD_TEXT_FIELD_LABELS.rulesText, multiline: true, richText: true },
  { key: "effectText", label: CARD_TEXT_FIELD_LABELS.effectText, multiline: true, richText: true },
];

export type NewCardFieldKey = CandidateCardFieldKey | "rulesText" | "effectText";

/** Splices the provider text columns back in after `domains`, where they have always read. */
export function buildNewCardFields(
  orders: EnumOrders,
  labels: EnumLabels,
): FieldDef<NewCardFieldKey>[] {
  const fields: FieldDef<NewCardFieldKey>[] = candidateCardFieldDefs(orders, labels);
  const afterDomains = fields.findIndex((field) => field.key === "domains") + 1;
  return fields.toSpliced(afterDomains, 0, ...NEW_CARD_TEXT_FIELDS);
}

/** Every column the accept-printing-field endpoint writes, plus the read-only provider columns that are shown but never sent. */
export type CandidatePrintingFieldKey =
  | AcceptPrintingField
  | "externalId"
  | "extraData"
  | "imageUrl";

export function candidatePrintingFieldDefs(
  orders: EnumOrders,
  labels: EnumLabels,
  markers: readonly { value: string; label: string }[],
  distributionChannels: readonly { value: string; label: string }[],
  artistSuggestions?: readonly string[],
  languages?: readonly { value: string; label: string }[],
): FieldDef<CandidatePrintingFieldKey>[] {
  return [
    {
      key: "externalId",
      label: SOURCE_COLUMN_LABELS.externalId,
      readOnly: true,
      collapsible: true,
    },
    { key: "publicCode", label: PRINTING_FIELD_LABELS.publicCode, alwaysVisible: true },

    {
      key: "rarity",
      label: PRINTING_FIELD_LABELS.rarity,
      labeledOptions: toLabeledOptions(orders.rarities, labels.rarities),
      iconCategory: "rarities",
      alwaysVisible: true,
    },
    {
      key: "finish",
      label: PRINTING_FIELD_LABELS.finish,
      labeledOptions: toLabeledOptions(orders.finishes, labels.finishes),
      alwaysVisible: true,
    },
    {
      key: "artVariant",
      label: PRINTING_FIELD_LABELS.artVariant,
      labeledOptions: toLabeledOptions(orders.artVariants, labels.artVariants),
    },
    {
      key: "size",
      label: PRINTING_FIELD_LABELS.size,
      labeledOptions: toLabeledOptions(orders.cardSizes, labels.cardSizes),
    },
    { key: "isSigned", label: PRINTING_FIELD_LABELS.isSigned, type: "boolean" },
    { key: "isOvernumbered", label: PRINTING_FIELD_LABELS.isOvernumbered, type: "boolean" },
    {
      key: "markerSlugs",
      label: PRINTING_FIELD_LABELS.markerSlugs,
      labeledOptions: markers.length > 0 ? markers : undefined,
      array: true,
    },
    {
      key: "distributionChannelSlugs",
      label: PRINTING_FIELD_LABELS.distributionChannelSlugs,
      labeledOptions: distributionChannels.length > 0 ? distributionChannels : undefined,
      array: true,
    },
    {
      key: "artist",
      label: PRINTING_FIELD_LABELS.artist,
      suggestions: artistSuggestions?.length ? artistSuggestions : undefined,
    },
    {
      key: "language",
      label: PRINTING_FIELD_LABELS.language,
      labeledOptions: languages && languages.length > 0 ? languages : undefined,
    },
    { key: "printedName", label: PRINTING_FIELD_LABELS.printedName },
    { key: "printedYear", label: PRINTING_FIELD_LABELS.printedYear, type: "number" },
    {
      key: "printedRulesText",
      label: PRINTING_FIELD_LABELS.printedRulesText,
      multiline: true,
      richText: true,
      alwaysVisible: true,
    },
    {
      key: "printedEffectText",
      label: PRINTING_FIELD_LABELS.printedEffectText,
      multiline: true,
      richText: true,
    },
    {
      key: "flavorText",
      label: PRINTING_FIELD_LABELS.flavorText,
      multiline: true,
      richText: true,
      richTextVariant: "flavor",
      alwaysVisible: true,
    },
    { key: "comment", label: PRINTING_FIELD_LABELS.comment },
    { key: "extraData", label: SOURCE_COLUMN_LABELS.extraData, readOnly: true, collapsible: true },
    { key: "imageUrl", label: SOURCE_COLUMN_LABELS.imageUrl, readOnly: true, alwaysVisible: true },
  ];
}

/** `ok` is false only for a number that does not parse; a blank input is `null`. */
export function parseFieldInput(
  field: Pick<FieldDef, "array" | "type">,
  raw: string,
): { ok: boolean; value: unknown } {
  const trimmed = raw.trim();
  if (field.array === true) {
    const items = trimmed
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return { ok: true, value: items.length > 0 ? items : null };
  }
  if (field.type === "number") {
    const parsed = parseIntegerInput(trimmed);
    return { ok: parsed !== undefined, value: parsed ?? null };
  }
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}

export function hasDropdown(field: FieldDef): boolean {
  return (
    (field.options !== undefined && field.options.length > 0) ||
    (field.labeledOptions !== undefined && field.labeledOptions.length > 0)
  );
}

export function isMultiSelect(field: FieldDef): boolean {
  return field.array === true && hasDropdown(field);
}

export function dropdownOptions(field: FieldDef): { value: string; label: string }[] {
  if (field.labeledOptions) {
    return field.labeledOptions.map((opt) => ({ value: opt.value, label: opt.label }));
  }
  return (field.options ?? []).map((opt) => ({ value: opt, label: opt }));
}

export function resolveLabel(field: FieldDef, value: unknown): string {
  const options = field.labeledOptions;
  return formatFieldValue(
    value,
    options
      ? (entry) => options.find((option) => option.value === entry)?.label ?? entry
      : undefined,
  );
}

export function candidateValueText(value: unknown, suffix: unknown): string {
  const text = formatFieldValue(value);
  return hasFieldValue(suffix) ? `${text} (${formatFieldValue(suffix)})` : text;
}

export function isValidOption(field: FieldDef, value: unknown): boolean {
  if (field.labeledOptions) {
    return Array.isArray(value)
      ? value.every((v) => field.labeledOptions?.some((o) => o.value === String(v)))
      : field.labeledOptions.some((o) => o.value === String(value));
  }
  if (field.options) {
    return Array.isArray(value)
      ? value.every((v) => field.options?.includes(String(v)))
      : field.options.includes(String(value));
  }
  return true;
}
