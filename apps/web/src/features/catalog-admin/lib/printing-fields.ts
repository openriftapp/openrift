import type { AcceptSubmissionInput } from "@openrift/shared/contracts/admin/catalog-review";
import type { CandidatePrintingResponse } from "@openrift/shared/types/api/admin";

import { hasFieldValue } from "@/features/catalog-admin/lib/catalog-field-labels";

type NewPrintingPick = NonNullable<AcceptSubmissionInput["newPrintings"]>[number];

export type AcceptPrintingFields = NewPrintingPick["printingFields"];

export const REQUIRED_PRINTING_FIELDS = [
  "shortCode",
  "setId",
  "rarity",
  "finish",
  "artist",
  "publicCode",
] as const;

export type RequiredPrintingField = (typeof REQUIRED_PRINTING_FIELDS)[number];

export const REQUIRED_PRINTING_FIELD_LABELS: Record<RequiredPrintingField, string> = {
  shortCode: "Short code",
  setId: "Set",
  rarity: "Rarity",
  finish: "Finish",
  artist: "Artist",
  publicCode: "Public code",
};

export function buildPrintingFieldsFromCandidate(
  candidate: CandidatePrintingResponse,
  overrides: Partial<Record<RequiredPrintingField, string>> = {},
): AcceptPrintingFields {
  const fields: AcceptPrintingFields = {
    shortCode: overrides.shortCode ?? candidate.shortCode,
    artist: overrides.artist ?? candidate.artist ?? "",
    publicCode: overrides.publicCode ?? candidate.publicCode ?? "",
    markerSlugs: candidate.markerSlugs,
    distributionChannelSlugs: candidate.distributionChannelSlugs,
  };

  const setId = overrides.setId ?? candidate.setId;
  if (hasFieldValue(setId)) {
    fields.setId = setId as string;
  }
  if (hasFieldValue(candidate.setName)) {
    fields.setName = candidate.setName;
  }
  const rarity = overrides.rarity ?? candidate.rarity;
  if (hasFieldValue(rarity)) {
    fields.rarity = rarity as string;
  }
  if (hasFieldValue(candidate.artVariant)) {
    fields.artVariant = candidate.artVariant as string;
  }
  if (candidate.isSigned !== null) {
    fields.isSigned = candidate.isSigned;
  }
  if (candidate.isOvernumbered !== null) {
    fields.isOvernumbered = candidate.isOvernumbered;
  }
  const finish = overrides.finish ?? candidate.finish;
  if (hasFieldValue(finish)) {
    fields.finish = finish as string;
  }
  if (hasFieldValue(candidate.size)) {
    fields.size = candidate.size as string;
  }
  if (hasFieldValue(candidate.printedRulesText)) {
    fields.printedRulesText = candidate.printedRulesText as string;
  }
  if (hasFieldValue(candidate.printedEffectText)) {
    fields.printedEffectText = candidate.printedEffectText as string;
  }
  if (hasFieldValue(candidate.flavorText)) {
    fields.flavorText = candidate.flavorText as string;
  }
  if (hasFieldValue(candidate.imageUrl)) {
    fields.imageUrl = candidate.imageUrl as string;
  }
  if (hasFieldValue(candidate.language)) {
    fields.language = candidate.language as string;
  }
  if (hasFieldValue(candidate.printedName)) {
    fields.printedName = candidate.printedName;
  }
  if (candidate.printedYear !== null) {
    fields.printedYear = candidate.printedYear;
  }

  return fields;
}

export function missingPrintingFields(fields: AcceptPrintingFields): RequiredPrintingField[] {
  const record = fields as Record<string, unknown>;
  return REQUIRED_PRINTING_FIELDS.filter((field) => !hasFieldValue(record[field]));
}

export function summarizeCandidatePrinting(candidate: CandidatePrintingResponse): string {
  const parts = [candidate.rarity, candidate.finish, candidate.artVariant].filter(
    (part): part is string => hasFieldValue(part),
  );
  return parts.length > 0 ? parts.join(" · ") : "No details";
}
