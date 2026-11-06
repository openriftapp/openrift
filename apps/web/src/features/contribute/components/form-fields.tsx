import { enumLabel } from "@openrift/shared/enum-label";
import type { ReactNode } from "react";
import { cloneElement, isValidElement, useId, useState } from "react";

import { ComboboxPicker } from "@/components/combobox-picker";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import type { PlaceholderField } from "@/features/cards/lib/card-placeholder-regions";
import { useFieldLink } from "@/features/contribute/components/contribute-field-focus";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export interface LabelledControlProps {
  id?: string;
  "aria-labelledby"?: string;
}

export function FieldRow({
  label,
  hint,
  error,
  required,
  field,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  field?: PlaceholderField;
  children: ReactNode;
}) {
  const generatedId = useId();
  const labelId = useId();
  const link = useFieldLink(field);
  const element = isValidElement<LabelledControlProps>(children) ? children : null;
  const controlId = element?.props.id ?? generatedId;
  const control = element
    ? cloneElement(element, {
        id: controlId,
        "aria-labelledby": element.props["aria-labelledby"] ?? labelId,
      })
    : children;

  return (
    <Field
      data-invalid={error ? true : undefined}
      {...link.props}
      className={cn(link.active && "ring-primary/40 -m-1 rounded-md p-1 ring-2 transition-shadow")}
    >
      <div className="flex items-center gap-1">
        <FieldLabel id={labelId} htmlFor={controlId}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </FieldLabel>
        {hint && <InfoHint label={label}>{hint}</InfoHint>}
      </div>
      {control}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

export function NumberInput({
  value,
  onChange,
  id,
  "aria-labelledby": ariaLabelledBy,
}: LabelledControlProps & {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <Input
      id={id}
      aria-labelledby={ariaLabelledBy}
      type="number"
      min={0}
      value={value === null ? "" : value.toString()}
      onChange={(e) => {
        const next = e.target.value;
        if (next === "") {
          onChange(null);
          return;
        }
        // oxlint-disable-next-line unicorn/prefer-number-coercion -- lenient parse of a form field; Number() would yield NaN on trailing text
        const parsed = Number.parseInt(next, 10);
        onChange(Number.isNaN(parsed) ? null : parsed);
      }}
      className="[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

export function SingleSelect({
  value,
  onChange,
  options,
  labels,
  placeholder,
  id,
  "aria-labelledby": ariaLabelledBy,
}: LabelledControlProps & {
  value: string | null;
  onChange: (next: string | null) => void;
  options: readonly string[];
  labels: Record<string, string>;
  placeholder: string;
}) {
  return (
    <SimpleSelect
      items={options.map((slug) => ({ value: slug, label: enumLabel(labels, slug) }))}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      id={id}
      aria-labelledby={ariaLabelledBy}
      className="w-full"
    />
  );
}

export function ChipInput({
  value,
  onChange,
  placeholder,
  id,
  "aria-labelledby": ariaLabelledBy,
}: LabelledControlProps & {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft("");
  };
  return (
    <Combobox<string, true>
      multiple
      items={value}
      value={value}
      onValueChange={onChange}
      inputValue={draft}
      onInputValueChange={setDraft}
    >
      <ComboboxChips>
        {value.map((chip) => (
          <ComboboxChip key={chip}>{chip}</ComboboxChip>
        ))}
        <ComboboxChipsInput
          id={id}
          aria-labelledby={ariaLabelledBy}
          placeholder={value.length === 0 ? placeholder : ""}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
        />
      </ComboboxChips>
    </Combobox>
  );
}

export function MultiSelectDropdown({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  id,
  "aria-labelledby": ariaLabelledBy,
}: LabelledControlProps & {
  value: string[];
  onChange: (next: string[]) => void;
  options: { slug: string; label: string }[];
  placeholder: string;
  searchPlaceholder: string;
}) {
  return (
    <ComboboxPicker
      multiple
      options={options.map((option) => ({ value: option.slug, label: option.label }))}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={m.contribute_no_matches()}
      contentClassName="w-72"
      id={id}
      aria-labelledby={ariaLabelledBy}
    />
  );
}
