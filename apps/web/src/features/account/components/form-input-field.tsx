import type { InputEvent } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function FormInputField({
  name,
  label,
  type,
  error,
  defaultValue,
  autoComplete,
  placeholder,
  autoFocus,
  onInput,
}: {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  error?: string;
  defaultValue?: string;
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onInput?: (event: InputEvent<HTMLInputElement>) => void;
}) {
  const invalid = error !== undefined;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- callers carry their own reason
        autoFocus={autoFocus}
        onInput={onInput}
      />
      {invalid && <FieldError>{error}</FieldError>}
    </Field>
  );
}
