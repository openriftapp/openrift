export const ADMIN_FILTER_ANY = "any";

export function withAnyOption<T extends string>(
  label: string,
  choices: readonly { value: T; label: string }[],
): { value: typeof ADMIN_FILTER_ANY | T; label: string }[] {
  return [{ value: ADMIN_FILTER_ANY, label }, ...choices];
}
