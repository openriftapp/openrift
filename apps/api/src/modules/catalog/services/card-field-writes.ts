import { normalizeNameForIdentity } from "@openrift/shared/card-name";
import type { AcceptCardField } from "@openrift/shared/contracts/admin/card-mutations";
import { cardFieldRules } from "@openrift/shared/db-field-rules";

import { cardUpdateFor } from "../lib/card-field-updates.js";
import {
  asFieldWriteError,
  cardNameRule,
  isUnchangedValue,
  trimOptionalText,
  validateFieldValue,
} from "../lib/field-values.js";
import type { catalogMutationsRepo } from "../repositories/catalog-mutations.js";

type CatalogMutationsRepo = ReturnType<typeof catalogMutationsRepo>;

const ARRAY_FIELDS = new Set(["types", "superTypes", "domains", "tags"]);

export function normalizeCardFieldValue(field: AcceptCardField, value: unknown): unknown {
  let normalized = value === null && ARRAY_FIELDS.has(field) ? [] : value;
  if (field === "comment") {
    normalized = trimOptionalText(normalized);
  } else if (field === "name" && typeof normalized === "string") {
    normalized = normalized.trim();
  }

  return validateFieldValue(
    field === "name" ? cardNameRule : cardFieldRules[field as keyof typeof cardFieldRules],
    field,
    normalized,
  );
}

export function cardFieldBefore(
  mut: CatalogMutationsRepo,
  cardId: string,
  field: AcceptCardField,
  cardBefore: object | undefined,
): Promise<unknown> {
  if (field === "types") {
    return mut.getCardTypesById(cardId);
  }
  if (field === "domains") {
    return mut.getCardDomainsById(cardId);
  }
  if (field === "superTypes") {
    return mut.getCardSuperTypesById(cardId);
  }
  return Promise.resolve((cardBefore as Record<string, unknown> | undefined)?.[field]);
}

export function normalizeCardName(name: string): string {
  return validateFieldValue(cardNameRule, "name", name.trim());
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
    try {
      await mut.replaceCardDomainsById(cardId, value as string[]);
    } catch (error: unknown) {
      throw asFieldWriteError(error, field, value);
    }
    return { refreshViews: true };
  }
  if (field === "superTypes") {
    try {
      await mut.replaceCardSuperTypesById(cardId, value as string[]);
    } catch (error: unknown) {
      throw asFieldWriteError(error, field, value);
    }
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

  // A rename can relink derived token references, which the catalog reads from a view.
  return { refreshViews: field === "name" };
}

type CardFieldAccept =
  | { status: "unchanged" }
  | { status: "changed" }
  | {
      status: "written";
      cardBefore: Awaited<ReturnType<CatalogMutationsRepo["getFullCardById"]>>;
      valueBefore: unknown;
      refreshViews: boolean;
    };

/**
 * Writes an accepted card field unless it already holds `value`. With `expected`, the write
 * happens only while the field still holds that value; the caller holds the card's row lock.
 */
export async function acceptCardFieldValue(
  mut: CatalogMutationsRepo,
  args: { cardId: string; field: AcceptCardField; value: unknown; expected?: unknown },
): Promise<CardFieldAccept> {
  const { cardId, field, value, expected } = args;
  const cardBefore = await mut.getFullCardById(cardId);
  const valueBefore = await cardFieldBefore(mut, cardId, field, cardBefore);
  if (isUnchangedValue(valueBefore, value, field)) {
    return { status: "unchanged" };
  }
  if (
    expected !== undefined &&
    !isUnchangedValue(valueBefore, normalizeCardFieldValue(field, expected), field)
  ) {
    return { status: "changed" };
  }
  const { refreshViews } = await writeCardField(mut, {
    cardId,
    field,
    value,
    previousName: cardBefore?.name ?? null,
  });
  return { status: "written", cardBefore, valueBefore, refreshViews };
}
