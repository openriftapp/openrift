import { hasFieldValue } from "@openrift/shared/catalog-field-compare";
import type { ComparablePrintingField } from "@openrift/shared/catalog-field-compare";
import { REQUIRED_PRINTING_FIELD_KEYS } from "@openrift/shared/contracts/admin/card-mutations";
import { fixTypography } from "@openrift/shared/fix-typography";
import type { ReactNode } from "react";
import { useState } from "react";

import { ComboboxPicker } from "@/components/combobox-picker";
import { LanguageChip } from "@/components/language-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import type { FieldDef } from "@/features/admin/components/candidate-field-defs";
import {
  dropdownOptions,
  hasDropdown,
  isMultiSelect,
  parseFieldInput,
} from "@/features/admin/components/candidate-field-defs";
import { PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { CardText } from "@/features/cards/components/card-text";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
import { useSets } from "@/features/cards/hooks/use-sets";
import { CardTextInput } from "@/features/contribute/components/card-text-input";
import { useCostKeywords } from "@/hooks/use-keyword-styles";

const RULES_FIELDS: ReadonlySet<string> = new Set(["printedRulesText", "printedEffectText"]);
const REQUIRED_FIELDS: ReadonlySet<string> = new Set(REQUIRED_PRINTING_FIELD_KEYS);
const YES = "yes";
const NO = "no";

export function FaceFieldValue({
  field,
  value,
  labels,
}: {
  field: ComparablePrintingField;
  value: unknown;
  labels: PrintingValueLabels;
}): ReactNode {
  if (hasFieldValue(value) && RULES_FIELDS.has(field)) {
    return <CardText text={String(value)} interactive={false} />;
  }
  if (hasFieldValue(value) && field === "flavorText") {
    return (
      <span className="text-muted-foreground whitespace-pre-line italic">{String(value)}</span>
    );
  }
  if (hasFieldValue(value) && field === "rarity") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <RarityIcon rarity={String(value)} />
        {formatCatalogFieldValue(field, value, labels)}
      </span>
    );
  }
  if (hasFieldValue(value) && field === "language") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <LanguageChip code={String(value)} />
        {formatCatalogFieldValue(field, value, labels)}
      </span>
    );
  }
  return formatCatalogFieldValue(field, value, labels);
}

function initialDraft(value: unknown): string {
  return hasFieldValue(value) ? String(value) : "";
}

export function FaceFieldEditor({
  field,
  def,
  value,
  pending,
  onSave,
  onCancel,
}: {
  field: ComparablePrintingField;
  def: FieldDef | undefined;
  value: unknown;
  pending: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}) {
  const label = PRINTING_FIELD_LABELS[field];
  const costKeywords = useCostKeywords();
  const { data: setData } = useSets();
  const [text, setText] = useState(initialDraft(value));
  const [list, setList] = useState<string[]>(Array.isArray(value) ? (value as string[]) : []);
  const required = REQUIRED_FIELDS.has(field);

  const kind =
    field === "setId"
      ? "set"
      : field === "isSigned" || field === "isOvernumbered"
        ? "boolean"
        : def !== undefined && isMultiSelect(def)
          ? "multi"
          : def !== undefined && hasDropdown(def)
            ? "select"
            : def?.multiline === true
              ? "text"
              : def?.type === "number"
                ? "number"
                : "line";

  const parsed = parseFieldInput({ type: kind === "number" ? "number" : undefined }, text);
  const invalid =
    !parsed.ok ||
    (required && kind === "multi" && list.length === 0) ||
    (required && kind !== "multi" && text.trim() === "");

  function save() {
    if (kind === "multi") {
      onSave(list.length > 0 ? list : null);
    } else if (kind === "boolean") {
      onSave(text === "true");
    } else {
      onSave(parsed.value);
    }
  }

  const options = def === undefined ? [] : dropdownOptions(def);

  return (
    <div className="space-y-2">
      {kind === "set" && (
        <SimpleSelect
          items={setData.sets.map((set) => ({
            value: set.slug,
            label: `${set.slug} · ${set.name}`,
          }))}
          value={text === "" ? null : text}
          onChange={setText}
          label={label}
          className="w-full sm:w-72"
        />
      )}
      {kind === "boolean" && (
        <SimpleSelect
          items={[
            { value: YES, label: "Yes" },
            { value: NO, label: "No" },
          ]}
          value={text === "true" ? YES : NO}
          onChange={(next) => setText(next === YES ? "true" : "false")}
          label={label}
          className="w-full sm:w-40"
        />
      )}
      {kind === "select" && (
        <SimpleSelect
          items={options}
          value={text === "" ? null : text}
          onChange={setText}
          label={label}
          className="w-full sm:w-56"
        />
      )}
      {kind === "multi" && (
        <ComboboxPicker
          multiple
          options={options}
          value={list}
          onChange={setList}
          aria-label={label}
          triggerLabel={
            list.length === 0
              ? "None"
              : list
                  .map((slug) => options.find((option) => option.value === slug)?.label ?? slug)
                  .join(", ")
          }
          searchPlaceholder={`Search ${label.toLowerCase()}…`}
          emptyText="No matches."
        />
      )}
      {kind === "text" && (
        <CardTextInput
          label={label}
          value={text}
          onChange={setText}
          rows={4}
          variant={field === "flavorText" ? "flavor" : "rules"}
          reformat={(next) =>
            field === "flavorText"
              ? fixTypography(next, { italicParens: false, keywordGlyphs: false })
              : fixTypography(next, { costKeywords })
          }
        />
      )}
      {(kind === "line" || kind === "number") && (
        <Input
          aria-label={label}
          value={text}
          inputMode={kind === "number" ? "numeric" : undefined}
          aria-invalid={invalid || undefined}
          onChange={(event) => setText(event.target.value)}
          className="w-full sm:w-72"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" pending={pending} disabled={invalid} onClick={save}>
          Save
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <span className="text-muted-foreground text-sm">Goes live as soon as you save.</span>
      </div>
    </div>
  );
}
