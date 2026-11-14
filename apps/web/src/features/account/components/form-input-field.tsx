import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function FormInputField<T extends FieldValues>({
  control,
  name,
  label,
  type,
  autoComplete,
  placeholder,
  autoFocus,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Input
            {...field}
            id={field.name}
            type={type}
            autoComplete={autoComplete}
            placeholder={placeholder}
            aria-invalid={fieldState.invalid}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- callers carry their own reason
            autoFocus={autoFocus}
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
