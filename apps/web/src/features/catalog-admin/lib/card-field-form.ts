import type { AcceptCardField } from "@openrift/shared/contracts/admin/card-mutations";
import { cardFieldRules } from "@openrift/shared/db-field-rules";
import type { AdminCardResponse } from "@openrift/shared/types/api/admin";

import {
  CARD_FIELD_LABELS,
  sameFieldValue,
} from "@/features/catalog-admin/lib/catalog-field-labels";

export const EDITABLE_CARD_FIELDS = [
  "name",
  "types",
  "superTypes",
  "domains",
  "tags",
  "might",
  "mightBonus",
  "energy",
  "power",
  "maxCopiesOverride",
  "comment",
] as const satisfies readonly AcceptCardField[];

export type EditableCardField = (typeof EDITABLE_CARD_FIELDS)[number];

export const EDITABLE_CARD_FIELD_LABELS: Record<EditableCardField, string> = {
  ...CARD_FIELD_LABELS,
  maxCopiesOverride: "Max copies override",
  comment: "Comment",
};

export const CARD_LIST_FIELDS = ["types", "superTypes", "domains", "tags"] as const;
export const CARD_NUMBER_FIELDS = [
  "might",
  "mightBonus",
  "energy",
  "power",
  "maxCopiesOverride",
] as const;

export type CardListField = (typeof CARD_LIST_FIELDS)[number];
export type CardNumberField = (typeof CARD_NUMBER_FIELDS)[number];

export interface CardFieldForm {
  name: string;
  types: string[];
  superTypes: string[];
  domains: string[];
  tags: string[];
  might: string;
  mightBonus: string;
  energy: string;
  power: string;
  maxCopiesOverride: string;
  comment: string;
}

export interface CardFieldValue {
  field: EditableCardField;
  value: unknown;
}

export interface CardFieldIssue {
  field: EditableCardField;
  message: string;
}

export interface CardFormParse {
  values: CardFieldValue[];
  issues: CardFieldIssue[];
}

export interface CardFormState {
  changes: CardFieldValue[];
  issues: CardFieldIssue[];
}

function numberText(value: number | null): string {
  return value === null ? "" : String(value);
}

export function cardFormFromCard(card: AdminCardResponse): CardFieldForm {
  return {
    name: card.name,
    types: [...card.types],
    superTypes: [...card.superTypes],
    domains: [...card.domains],
    tags: [...card.tags],
    might: numberText(card.might),
    mightBonus: numberText(card.mightBonus),
    energy: numberText(card.energy),
    power: numberText(card.power),
    maxCopiesOverride: numberText(card.maxCopiesOverride),
    comment: card.comment ?? "",
  };
}

export function parseListInput(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function formatListInput(values: readonly string[]): string {
  return values.join(", ");
}

function parseNumberInput(text: string): number | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : "invalid";
}

function rawValue(form: CardFieldForm, field: EditableCardField): unknown {
  if (field === "name") {
    return form.name.trim();
  }
  if (field === "comment") {
    return form.comment.trim() === "" ? null : form.comment.trim();
  }
  if (field === "types" || field === "superTypes" || field === "domains" || field === "tags") {
    return form[field];
  }
  return parseNumberInput(form[field]);
}

export function parseCardForm(form: CardFieldForm): CardFormParse {
  const values: CardFieldValue[] = [];
  const issues: CardFieldIssue[] = [];

  for (const field of EDITABLE_CARD_FIELDS) {
    const value = rawValue(form, field);
    const label = EDITABLE_CARD_FIELD_LABELS[field];
    if (value === "invalid") {
      issues.push({ field, message: `${label} must be a whole number.` });
      continue;
    }
    const result = cardFieldRules[field].safeParse(value);
    if (result.success) {
      values.push({ field, value });
      continue;
    }
    issues.push({ field, message: `${label} is not valid.` });
  }

  return { values, issues };
}

function changedValues(
  values: readonly CardFieldValue[],
  card: AdminCardResponse,
): CardFieldValue[] {
  const current = card as unknown as Record<string, unknown>;
  return values.filter((entry) => !sameFieldValue(current[entry.field], entry.value, entry.field));
}

export function cardFormChanges(form: CardFieldForm, card: AdminCardResponse): CardFieldValue[] {
  return changedValues(parseCardForm(form).values, card);
}

function sameFormField(
  left: CardFieldForm,
  right: CardFieldForm,
  field: EditableCardField,
): boolean {
  const a = left[field];
  const b = right[field];
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => entry === b[index]);
  }
  return a === b;
}

// Only edited fields report an issue: a card that arrives without types or
// domains must still accept an edit to another field.
export function cardFormState(form: CardFieldForm, card: AdminCardResponse): CardFormState {
  const baseline = cardFormFromCard(card);
  const { values, issues } = parseCardForm(form);
  return {
    changes: changedValues(values, card),
    issues: issues.filter((issue) => !sameFormField(baseline, form, issue.field)),
  };
}

export function applyFieldValue(
  form: CardFieldForm,
  field: EditableCardField,
  value: unknown,
): CardFieldForm {
  if (field === "types" || field === "superTypes" || field === "domains" || field === "tags") {
    return { ...form, [field]: Array.isArray(value) ? value.map(String) : [] };
  }
  const isPrimitive =
    typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  return { ...form, [field]: isPrimitive ? String(value) : "" };
}
