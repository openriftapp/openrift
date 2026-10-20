import { isPrintingLevelField } from "@openrift/shared/printing-field-level";

export type DeskFieldScope = "all" | "printing" | "face";

export function fieldsInScope<T extends Record<string, unknown>>(
  fields: T,
  scope: DeskFieldScope,
): Partial<T> {
  if (scope === "all") {
    return fields;
  }
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => isPrintingLevelField(key) === (scope === "printing")),
  ) as Partial<T>;
}
