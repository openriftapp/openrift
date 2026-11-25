import type {
  ComparableCardField,
  ComparablePrintingField,
} from "@openrift/shared/catalog-field-compare";
import {
  COMPARABLE_CARD_FIELDS,
  COMPARABLE_PRINTING_FIELDS,
  differingFields,
  hasFieldValue,
  isDismissedValue,
} from "@openrift/shared/catalog-field-compare";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import { normalizeProvidedPrintingValue } from "@openrift/shared/printing-value-normalize";
import { withoutCoveredRelease } from "@openrift/shared/set-release";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidateCardResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";

import { printingAsAccepted } from "@/features/admin/lib/printing-fields";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";

export interface CompareContext {
  costKeywords: readonly string[];
  setTotals: Record<string, number>;
  hiddenProviders?: ReadonlySet<string>;
}

export interface FieldDifference<F extends string> {
  field: F;
  current: unknown;
  proposed: unknown;
}

export const FACE_FIELDS = COMPARABLE_PRINTING_FIELDS.filter(
  (field) => !isPrintingLevelField(field),
);

export const PRINTING_FIELDS = COMPARABLE_PRINTING_FIELDS.filter((field) =>
  isPrintingLevelField(field),
);

export function hiddenProviders(
  providerSettings: readonly ProviderSettingResponse[],
  isAdmin: boolean,
): Set<string> {
  return new Set(
    providerSettings
      .filter((setting) => setting.isHidden || (!isAdmin && !setting.helperReviewable))
      .map((setting) => setting.provider),
  );
}

export function providerOf(detail: AdminCardDetailResponse, candidateCardId: string): string {
  return detail.sources.find((source) => source.id === candidateCardId)?.provider ?? "Source";
}

export function isContributorProvider(provider: string): boolean {
  return provider === USER_SUBMISSION_PROVIDER;
}

export function cardDifferences(
  card: Readonly<Record<string, unknown>> | null,
  source: CandidateCardResponse,
): FieldDifference<ComparableCardField>[] {
  const live = (card ?? {}) as Record<ComparableCardField, unknown>;
  const proposed = source as unknown as Record<ComparableCardField, unknown>;
  return differingFields(COMPARABLE_CARD_FIELDS, live, proposed, source.dismissedValues).map(
    (field) => ({ field, current: live[field] ?? null, proposed: proposed[field] }),
  );
}

/**
 * Compares the way the accept path would store the source's values, and drops a release
 * date the printing's set already covers.
 */
export function printingDifferences(
  candidate: CandidatePrintingResponse,
  row: AdminPrintingResponse,
  fields: readonly ComparablePrintingField[],
  context: Pick<CompareContext, "costKeywords" | "setTotals">,
): FieldDifference<ComparablePrintingField>[] {
  const options = {
    costKeywords: context.costKeywords,
    printedTotal: context.setTotals[row.setSlug] ?? null,
  };
  const live = printingAsAccepted(row) as unknown as Record<ComparablePrintingField, unknown>;
  const raw = candidate as unknown as Record<string, unknown>;
  const proposed = Object.fromEntries(
    fields.map((field) => [field, normalizeProvidedPrintingValue(field, raw[field], options)]),
  ) as Record<ComparablePrintingField, unknown>;
  const differing = withoutCoveredRelease(
    differingFields(fields, live, proposed, candidate.dismissedValues),
    { releasedAt: row.releasedAt, setReleasedAt: row.setReleasedAt },
    { releasedAt: candidate.releasedAt, releasePrecision: candidate.releasePrecision },
  );
  return differing.map((field) => ({
    field,
    current: live[field] ?? null,
    proposed: proposed[field],
  }));
}

export function ownImageUrls(
  images: readonly AdminPrintingImageResponse[],
  printing: AdminPrintingResponse,
): Set<string | null> {
  return new Set(imagesOnSide(images, printing).map((image) => image.originalUrl));
}

export function candidateHasNewImage(
  candidate: CandidatePrintingResponse,
  ownUrls: ReadonlySet<string | null>,
  isContributor: boolean,
): boolean {
  return (
    hasFieldValue(candidate.imageUrl) &&
    !isDismissedValue(candidate.dismissedValues, "imageUrl", candidate.imageUrl) &&
    (isContributor || candidate.imageMatch !== "same") &&
    !ownUrls.has(candidate.imageUrl)
  );
}

/**
 * A candidate printing carries no side, so a printing with this card on both faces is
 * split by short code, the way the API picks the face for an accepted image.
 */
export function candidateBelongsToFace(
  candidate: CandidatePrintingResponse,
  faceId: string,
  printings: readonly AdminPrintingResponse[],
): boolean {
  if (candidate.printingId === null) {
    return false;
  }
  const rows = printings.filter((row) => row.id === candidate.printingId);
  const own = rows.find((row) => row.faceId === faceId);
  if (own === undefined) {
    return false;
  }
  if (rows.length < 2) {
    return true;
  }
  const code = candidate.shortCode.toUpperCase();
  const front = rows.find((row) => row.side === 1);
  const back = rows.find((row) => row.side === 2);
  const side =
    back !== undefined &&
    back.shortCode.toUpperCase() === code &&
    front?.shortCode.toUpperCase() !== code
      ? 2
      : 1;
  return own.side === side;
}

export function candidateFaceRow(
  candidate: CandidatePrintingResponse,
  printings: readonly AdminPrintingResponse[],
): AdminPrintingResponse | undefined {
  return printings.find(
    (row) =>
      row.id === candidate.printingId && candidateBelongsToFace(candidate, row.faceId, printings),
  );
}
