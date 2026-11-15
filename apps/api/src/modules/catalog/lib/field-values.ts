import { normalizeNameForIdentity } from "@openrift/shared/card-name";
import { cardFieldRules } from "@openrift/shared/db-field-rules";
import { trimToNull } from "@openrift/shared/strings";
import type { ZodType } from "zod";

import { badRequest } from "../../../errors.js";
import { isForeignKeyViolation } from "../../../lib/pg-errors.js";

export const cardNameRule = cardFieldRules.name.refine(
  (name) => normalizeNameForIdentity(name) !== "",
  { message: "needs at least one letter or digit" },
);

/** Blank text is stored as null, the same value clearing the field writes. */
export function trimOptionalText(value: unknown): unknown {
  return typeof value === "string" ? trimToNull(value) : value;
}

/** True when a scalar write would store what the row already holds. */
export function isUnchangedValue(before: unknown, after: unknown): boolean {
  return after !== undefined && (after === null || typeof after !== "object") && before === after;
}

export function validateFieldValue<T>(validator: ZodType<T>, field: string, value: unknown): T;
export function validateFieldValue(
  validator: ZodType | undefined,
  field: string,
  value: unknown,
): unknown;
export function validateFieldValue(
  validator: ZodType | undefined,
  field: string,
  value: unknown,
): unknown {
  if (!validator) {
    return value;
  }
  const parsed = validator.safeParse(value);
  if (!parsed.success) {
    throw badRequest(
      `Invalid value for ${field}: ${parsed.error.issues[0]?.message ?? "invalid value"}`,
    );
  }
  return parsed.data;
}

/** A foreign-key violation on a field write means an unknown slug reached an FK-backed column. */
export function asFieldWriteError(error: unknown, field: string, value: unknown): unknown {
  if (isForeignKeyViolation(error)) {
    return badRequest(`Invalid value for ${field}: ${String(value)}`);
  }
  return error;
}
