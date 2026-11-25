import { hasFieldValue } from "@openrift/shared/catalog-field-compare";
import type { KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { MultiSelectCell } from "@/features/admin/components/candidate-cell-editors";
import type { FieldDef } from "@/features/admin/components/candidate-field-defs";
import {
  dropdownOptions,
  isMultiSelect,
  parseFieldInput,
} from "@/features/admin/components/candidate-field-defs";

export function NewCardFieldEditor({
  field,
  value,
  required,
  onCommit,
  onClose,
}: {
  field: FieldDef;
  value: unknown;
  required: boolean;
  onCommit: (value: unknown) => void;
  onClose: () => void;
}) {
  function commit(next: unknown) {
    if (!(required && !hasFieldValue(next))) {
      onCommit(next);
    }
  }

  const text = Array.isArray(value) ? value.join(", ") : hasFieldValue(value) ? String(value) : "";

  function finish(raw: string) {
    const parsed = parseFieldInput(field, raw);
    if (parsed.ok) {
      commit(parsed.value);
    }
    onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(event.currentTarget.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  if (isMultiSelect(field)) {
    return (
      <MultiSelectCell
        label={field.label}
        options={dropdownOptions(field)}
        value={Array.isArray(value) ? (value as string[]) : []}
        onCommit={commit}
        onClose={onClose}
      />
    );
  }

  return (
    <Input
      aria-label={field.label}
      defaultValue={text}
      inputMode={field.type === "number" ? "numeric" : undefined}
      onBlur={(event) => finish(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      className="w-full max-w-sm"
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- opened by its Edit button, focus follows the click
      autoFocus
    />
  );
}
