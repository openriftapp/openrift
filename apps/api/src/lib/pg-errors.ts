/**
 * postgres.js surfaces the five-character SQLSTATE on `error.code`, so a
 * structural check is all these need; no driver types are imported.
 */

/** True if the error is a Postgres unique-constraint violation (SQLSTATE 23505). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

/** True if the error is a Postgres foreign-key violation (SQLSTATE 23503). */
export function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23503"
  );
}

/**
 * True if the violation is on one of the named constraints. Use over
 * {@link isUniqueViolation} when a block can raise 23505 from more than one index.
 */
export function isUniqueViolationOn(
  error: unknown,
  ...constraintNames: [string, ...string[]]
): boolean {
  if (!isUniqueViolation(error)) {
    return false;
  }
  const name = (error as { constraint_name?: unknown }).constraint_name;
  return typeof name === "string" && constraintNames.includes(name);
}

export function isForeignKeyViolationOn(error: unknown, constraintName: string): boolean {
  return (
    isForeignKeyViolation(error) &&
    (error as { constraint_name?: unknown }).constraint_name === constraintName
  );
}

/** Raised by `trg_distribution_channels_validate` when a write breaks the channel hierarchy. */
export const HIERARCHY_REJECTED_SQLSTATE = "OR001";

/** True if the error carries the SQLSTATE a plpgsql `RAISE ... USING ERRCODE` set. */
export function isRaisedWith(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

/** True if the error is a Postgres check-constraint violation (SQLSTATE 23514). */
export function isCheckViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23514"
  );
}
