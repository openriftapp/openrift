import type { z } from "zod/v4";

export type FieldErrors = Partial<Record<string, string>>;

export function formText(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value : "";
}

export function parseFormData<TSchema extends z.ZodType>(
  schema: TSchema,
  form: HTMLFormElement,
): { ok: true; values: z.output<TSchema> } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(Object.fromEntries(new FormData(form)));
  if (result.success) {
    return { ok: true, values: result.data };
  }
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    errors[String(issue.path[0] ?? "root")] ??= issue.message;
  }
  return { ok: false, errors };
}
