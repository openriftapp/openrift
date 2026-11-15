import type { InputEvent, SubmitEvent } from "react";
import { useState } from "react";
import type { z } from "zod/v4";

import type { FieldErrors } from "@/features/account/lib/form-data";
import { parseFormData } from "@/features/account/lib/form-data";

/**
 * Validates an uncontrolled form's values at submit and focuses the first invalid field.
 * A field's error clears when it is edited; `setError` matches `setServerError`.
 */
export function useAccountForm<TSchema extends z.ZodType>(schema: TSchema) {
  const [errors, setErrors] = useState<FieldErrors>({});

  function setError(field: string, error: { message?: string }) {
    setErrors((current) => ({ ...current, [field]: error.message }));
  }

  function handleInput(event: InputEvent<HTMLFormElement>) {
    const { target } = event;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    const { name } = target;
    setErrors((current) =>
      current[name] === undefined ? current : { ...current, [name]: undefined },
    );
  }

  function handleSubmit(
    onValid: (values: z.output<TSchema>, form: HTMLFormElement) => Promise<void> | void,
  ) {
    return (event: SubmitEvent<HTMLFormElement>) => {
      const form = event.currentTarget;
      const parsed = parseFormData(schema, form);
      setErrors(parsed.ok ? {} : parsed.errors);
      if (parsed.ok) {
        void onValid(parsed.values, form);
        return;
      }
      const { errors: fieldErrors } = parsed;
      const firstInvalid = [...form.elements].find(
        (element): element is HTMLInputElement | HTMLTextAreaElement =>
          (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
          fieldErrors[element.name] !== undefined,
      );
      firstInvalid?.focus();
    };
  }

  return { errors, setError, handleInput, handleSubmit };
}
