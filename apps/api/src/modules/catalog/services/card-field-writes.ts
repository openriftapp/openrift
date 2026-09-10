import type { AcceptCardField } from "@openrift/shared/contracts/admin/card-mutations";
import { cardFieldRules } from "@openrift/shared/db-field-rules";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { normalizeNameForIdentity } from "@openrift/shared/utils";

import { AppError } from "../../../errors.js";
import { cardUpdateFor } from "../lib/card-field-updates.js";
import type { catalogMutationsRepo } from "../repositories/catalog-mutations.js";

type CatalogMutationsRepo = ReturnType<typeof catalogMutationsRepo>;

const ARRAY_FIELDS = new Set(["types", "superTypes", "domains", "tags"]);

export function normalizeCardFieldValue(field: AcceptCardField, value: unknown): unknown {
  const normalized = value === null && ARRAY_FIELDS.has(field) ? [] : value;

  const validator = cardFieldRules[field as keyof typeof cardFieldRules];
  if (validator) {
    const parsed = validator.safeParse(normalized);
    if (!parsed.success) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid value for ${field}: ${parsed.error.issues[0]?.message ?? "invalid value"}`,
      );
    }
  }

  return normalized;
}

/**
 * `previousName` reconciles the self-alias on a rename; the caller's snapshot
 * of `cards.name` is the only source for it once the update has landed.
 */
export async function writeCardField(
  mut: CatalogMutationsRepo,
  args: {
    cardId: string;
    field: AcceptCardField;
    value: unknown;
    previousName?: string | null;
  },
): Promise<{ refreshViews: boolean }> {
  const { cardId, field, value, previousName } = args;

  if (field === "domains") {
    await mut.replaceCardDomainsById(cardId, value as string[]);
    return { refreshViews: true };
  }
  if (field === "superTypes") {
    await mut.replaceCardSuperTypesById(cardId, value as string[]);
    return { refreshViews: true };
  }
  if (field === "types") {
    try {
      await mut.replaceCardTypesById(cardId, value as string[]);
    } catch (error: unknown) {
      throw asFieldError(error, field, value);
    }
    return { refreshViews: true };
  }

  try {
    await mut.updateCardById(cardId, cardUpdateFor(field, value));
  } catch (error: unknown) {
    throw asFieldError(error, field, value);
  }

  if (field === "name" && typeof value === "string" && previousName) {
    await mut.syncSelfAliasOnRename(
      cardId,
      normalizeNameForIdentity(previousName),
      normalizeNameForIdentity(value),
    );
  }

  return { refreshViews: false };
}

/** 23503 foreign_key_violation: an unknown slug reached a FK-backed column. */
function asFieldError(error: unknown, field: string, value: unknown): unknown {
  if (error instanceof Error && "code" in error && error.code === "23503") {
    return new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `Invalid value for ${field}: ${String(value)}`,
    );
  }
  return error;
}
