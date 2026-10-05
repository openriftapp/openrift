import { normalizeNameForIdentity } from "@openrift/shared/card-name";
import type { AcceptCardField } from "@openrift/shared/contracts/admin/card-mutations";
import { cardFieldRules } from "@openrift/shared/db-field-rules";

import { cardUpdateFor } from "../lib/card-field-updates.js";
import { asFieldWriteError, validateFieldValue } from "../lib/field-values.js";
import type { catalogMutationsRepo } from "../repositories/catalog-mutations.js";

type CatalogMutationsRepo = ReturnType<typeof catalogMutationsRepo>;

const ARRAY_FIELDS = new Set(["types", "superTypes", "domains", "tags"]);

export function normalizeCardFieldValue(field: AcceptCardField, value: unknown): unknown {
  const normalized = value === null && ARRAY_FIELDS.has(field) ? [] : value;

  validateFieldValue(cardFieldRules[field as keyof typeof cardFieldRules], field, normalized);
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
      throw asFieldWriteError(error, field, value);
    }
    return { refreshViews: true };
  }

  try {
    await mut.updateCardById(cardId, cardUpdateFor(field, value));
  } catch (error: unknown) {
    throw asFieldWriteError(error, field, value);
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
