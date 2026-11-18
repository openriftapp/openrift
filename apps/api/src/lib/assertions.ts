import { badRequest, conflict, notFound } from "../errors.js";
import { isForeignKeyViolationOn, isUniqueViolationOn } from "./pg-errors.js";

export function assertFound<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value === null || value === undefined) {
    throw notFound(message);
  }
}

export async function conflictOnUniqueViolation<T>(
  constraintName: string,
  message: string,
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolationOn(error, constraintName)) {
      throw conflict(message);
    }
    throw error;
  }
}

export function assertSlugAvailable(
  existing: unknown,
  identifier: string,
  entityName: string,
): void {
  if (existing !== null && existing !== undefined) {
    throw conflict(`${entityName} "${identifier}" already exists`);
  }
}

/**
 * `keyNoun` and `unknownLabel` are kept separate because the wording diverges
 * across taxonomies: `keyNoun` fills the duplicate/count messages (e.g.
 * `"ids"`, `"slugs"`, `"language codes"`) and `unknownLabel` fills the
 * unknown-keys message (e.g. `"marker ids"`, `"finish slugs"`).
 */
export function assertValidReorder<Row>(
  keys: readonly string[],
  rows: readonly Row[],
  options: { keyOf: (row: Row) => string; keyNoun: string; unknownLabel: string },
): void {
  const { keyOf, keyNoun, unknownLabel } = options;

  const uniqueKeys = new Set(keys);
  if (uniqueKeys.size !== keys.length) {
    throw badRequest(`Duplicate ${keyNoun} in reorder list.`);
  }

  if (keys.length !== rows.length) {
    throw badRequest(`Expected ${rows.length} ${keyNoun}, got ${keys.length}.`);
  }

  const knownKeys = new Set(rows.map((row) => keyOf(row)));
  const unknown = keys.filter((key) => !knownKeys.has(key));
  if (unknown.length > 0) {
    throw badRequest(`Unknown ${unknownLabel}: ${unknown.join(", ")}`);
  }
}

export function assertExisted(existed: boolean, message: string): void {
  if (!existed) {
    throw notFound(message);
  }
}

export function assertUpdated(
  result: { numUpdatedRows: bigint } | null | undefined,
  message: string,
): void {
  if (!result || result.numUpdatedRows === 0n) {
    throw notFound(message);
  }
}

export function assertDeleted(
  result: { numDeletedRows: bigint } | null | undefined,
  message: string,
): void {
  if (!result || result.numDeletedRows === 0n) {
    throw notFound(message);
  }
}

const NEW_CARD_ENUM_KEYS = [
  ["fk_card_card_types_type_slug", "types"],
  ["fk_card_domains_domain_slug", "domains"],
  ["fk_card_super_types_super_type_slug", "superTypes"],
] as const;

/** Runs a new card's write; an unknown type, domain or supertype slug becomes a 400 naming the field. */
export async function badRequestOnUnknownCardEnum<T>(
  fields: { types: readonly string[]; domains: readonly string[]; superTypes?: readonly string[] },
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    for (const [constraint, field] of NEW_CARD_ENUM_KEYS) {
      if (isForeignKeyViolationOn(error, constraint)) {
        throw badRequest(`Invalid value for ${field}: ${(fields[field] ?? []).join(", ")}`);
      }
    }
    throw error;
  }
}
