import type { ZodType } from "zod";

import { badRequest } from "../../../errors.js";
import { isForeignKeyViolation } from "../../../lib/pg-errors.js";

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
