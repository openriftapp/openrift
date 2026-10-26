import type { ComparablePrintingField } from "@openrift/shared/catalog-field-compare";
import {
  COMPARABLE_PRINTING_FIELDS,
  hasFieldValue,
  sameFieldValue,
} from "@openrift/shared/catalog-field-compare";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import { normalizeProvidedPrintingValue } from "@openrift/shared/printing-value-normalize";
import { pluralize } from "@openrift/shared/strings";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

import { formatFieldValue, PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";

export interface CompareContext {
  costKeywords: readonly string[];
  setTotals: Record<string, number>;
  hiddenProviders?: ReadonlySet<string>;
}

export interface FieldSuggestion {
  key: string;
  field: ComparablePrintingField;
  label: string;
  current: unknown;
  proposed: unknown;
  candidate: CandidatePrintingResponse;
  printingId: string;
  faceId: string;
  provider: string;
  isContributor: boolean;
}

export interface SuggestionSource {
  candidatePrintingId: string;
  candidateCardId: string;
  provider: string;
  isContributor: boolean;
  differences: number;
  elsewhere: string | null;
}

export interface SourceImageCandidate {
  candidate: CandidatePrintingResponse;
  url: string;
  provider: string;
  isContributor: boolean;
}

export interface FaceSuggestionModel {
  face: AdminPrintingResponse | null;
  printings: AdminPrintingResponse[];
  images: AdminPrintingImageResponse[];
  suggestions: FieldSuggestion[];
  sources: SuggestionSource[];
  sourceImages: SourceImageCandidate[];
  agreeingFields: number;
  enterCandidateIds: string[];
}

export const FACE_FIELDS = COMPARABLE_PRINTING_FIELDS.filter(
  (field) => !isPrintingLevelField(field),
);

export const PRINTING_FIELDS = COMPARABLE_PRINTING_FIELDS.filter((field) =>
  isPrintingLevelField(field),
);

export function candidateHasNewImage(
  candidate: CandidatePrintingResponse,
  ownUrls: ReadonlySet<string | null>,
): boolean {
  return (
    hasFieldValue(candidate.imageUrl) &&
    candidate.imageMatch !== "same" &&
    !ownUrls.has(candidate.imageUrl)
  );
}

export function describeElsewhere(counts: {
  faceFields?: number;
  printingFields?: number;
  images?: number;
}): string | null {
  const parts = [
    [counts.faceFields ?? 0, "face field"],
    [counts.printingFields ?? 0, "printing field"],
    [counts.images ?? 0, "image"],
  ] as const;
  const named = parts
    .filter(([count]) => count > 0)
    .map(([count, noun]) => `${count} ${pluralize(count, noun)}`);
  return named.length === 0 ? null : named.join(" and ");
}

export function compareCandidate(
  candidate: CandidatePrintingResponse,
  row: AdminPrintingResponse,
  fields: readonly ComparablePrintingField[],
  context: CompareContext,
  provider: string,
): { suggestions: FieldSuggestion[]; agreeing: number } {
  const printedTotal = context.setTotals[row.setSlug] ?? null;
  const live = row as unknown as Record<string, unknown>;
  const proposedRow = candidate as unknown as Record<string, unknown>;
  const suggestions: FieldSuggestion[] = [];
  let agreeing = 0;
  for (const field of fields) {
    const proposed = normalizeProvidedPrintingValue(field, proposedRow[field], {
      costKeywords: context.costKeywords,
      printedTotal,
    });
    if (!hasFieldValue(proposed)) {
      continue;
    }
    const current = live[field] ?? null;
    if (sameFieldValue(current, proposed, field)) {
      agreeing += 1;
      continue;
    }
    suggestions.push({
      key: `${candidate.id}:${field}`,
      field,
      label: PRINTING_FIELD_LABELS[field],
      current,
      proposed,
      candidate,
      printingId: row.id,
      faceId: row.faceId,
      provider,
      isContributor: provider === USER_SUBMISSION_PROVIDER,
    });
  }
  return { suggestions, agreeing };
}

export function discardLabel(
  differences: number,
  provider: string,
  elsewhere?: string | null,
): string {
  const base = differences <= 1 ? "Discard" : `Discard ${differences} from ${provider}`;
  return elsewhere === null || elsewhere === undefined
    ? base
    : `${base} (also settles ${elsewhere})`;
}

export const ADMIN_ONLY_DISCARD = "Only an admin discards source suggestions.";
export const ADMIN_ONLY_REPLY = "Only an admin replies to contributors.";

export function discardedLabel(
  sources: readonly SuggestionSource[],
  candidatePrintingIds: readonly string[],
): string {
  const picked = sources.filter((source) =>
    candidatePrintingIds.includes(source.candidatePrintingId),
  );
  const differences = picked.reduce((sum, source) => sum + source.differences, 0);
  const providers = [...new Set(picked.map((source) => source.provider))];
  const from = providers.length === 0 ? "" : ` from ${providers.join(", ")}`;
  return differences === 0
    ? `Discarded ${picked.length} ${pluralize(picked.length, "source")}${from}`
    : `Discarded ${differences} ${pluralize(differences, "suggestion")}${from}`;
}

export function faceCompareCandidates(
  detail: AdminCardDetailResponse,
  faceId: string,
  hiddenProviders: ReadonlySet<string> = new Set(),
): CandidatePrintingResponse[] {
  const sourceIds = new Set(detail.sources.map((source) => source.id));
  return detail.candidatePrintings.filter(
    (candidate) =>
      sourceIds.has(candidate.candidateCardId) &&
      !hiddenProviders.has(providerOf(detail, candidate.candidateCardId)) &&
      candidateBelongsToFace(candidate, faceId, detail.printings),
  );
}

export function primaryLabel(discardCount: number): string {
  return discardCount === 0 ? "Next" : `Discard ${discardCount} & next`;
}

export function providerOf(detail: AdminCardDetailResponse, candidateCardId: string): string {
  return detail.sources.find((source) => source.id === candidateCardId)?.provider ?? "Source";
}

export function submitterNameOf(
  details: readonly AdminCardDetailResponse[],
  candidateCardId: string,
): string | null {
  for (const detail of details) {
    const source = detail.sources.find((entry) => entry.id === candidateCardId);
    if (source !== undefined) {
      return source.submittedByName;
    }
  }
  return null;
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

export function buildFaceSuggestions(
  detail: AdminCardDetailResponse,
  faceId: string,
  context: CompareContext,
): FaceSuggestionModel {
  const printings = detail.printings.filter((row) => row.faceId === faceId);
  const face = printings[0] ?? null;
  if (face === null) {
    return {
      face,
      printings,
      images: [],
      suggestions: [],
      sources: [],
      sourceImages: [],
      agreeingFields: 0,
      enterCandidateIds: [],
    };
  }

  const images = imagesOnSide(detail.printingImages, face);
  const ownUrls = new Set(images.map((image) => image.originalUrl));
  const sourceIds = new Set(detail.sources.map((source) => source.id));
  const hidden = context.hiddenProviders ?? new Set<string>();
  const candidates = detail.candidatePrintings.filter(
    (candidate) =>
      candidate.checkedAt === null &&
      sourceIds.has(candidate.candidateCardId) &&
      !hidden.has(providerOf(detail, candidate.candidateCardId)) &&
      candidateBelongsToFace(candidate, faceId, detail.printings),
  );

  const suggestions: FieldSuggestion[] = [];
  const sources: SuggestionSource[] = [];
  const sourceImages: SourceImageCandidate[] = [];
  const enterCandidateIds: string[] = [];
  let agreeingFields = 0;

  for (const candidate of candidates) {
    const provider = providerOf(detail, candidate.candidateCardId);
    const isContributor = provider === USER_SUBMISSION_PROVIDER;
    const row = printings.find((entry) => entry.id === candidate.printingId) ?? face;
    const faceCompare = compareCandidate(candidate, row, FACE_FIELDS, context, provider);
    const printingDiffs = compareCandidate(candidate, row, PRINTING_FIELDS, context, provider)
      .suggestions.length;
    const hasImage = candidateHasNewImage(candidate, ownUrls);
    if (hasImage) {
      sourceImages.push({ candidate, url: candidate.imageUrl as string, provider, isContributor });
    }
    suggestions.push(...faceCompare.suggestions);
    agreeingFields = Math.max(agreeingFields, faceCompare.agreeing);
    const differences = faceCompare.suggestions.length + (hasImage ? 1 : 0);
    sources.push({
      candidatePrintingId: candidate.id,
      candidateCardId: candidate.candidateCardId,
      provider,
      isContributor,
      differences,
      elsewhere: describeElsewhere({ printingFields: printingDiffs }),
    });
    if (!isContributor && printingDiffs === 0) {
      enterCandidateIds.push(candidate.id);
    }
  }

  return {
    face,
    printings,
    images,
    suggestions,
    sources,
    sourceImages,
    agreeingFields,
    enterCandidateIds,
  };
}

export interface ValueLabels {
  rarities: Record<string, string>;
  finishes: Record<string, string>;
  artVariants: Record<string, string>;
  cardSizes: Record<string, string>;
  languages: Record<string, string>;
  markers: Record<string, string>;
  channels: Record<string, string>;
}

const SLUG_LABEL_GROUPS: Partial<Record<string, keyof ValueLabels>> = {
  rarity: "rarities",
  finish: "finishes",
  artVariant: "artVariants",
  size: "cardSizes",
  language: "languages",
};

const LIST_LABEL_GROUPS: Partial<Record<string, keyof ValueLabels>> = {
  markerSlugs: "markers",
  distributionChannelSlugs: "channels",
};

export function formatSuggestionValue(field: string, value: unknown, labels: ValueLabels): string {
  if (!hasFieldValue(value)) {
    return "Empty";
  }
  const slugGroup = SLUG_LABEL_GROUPS[field];
  if (slugGroup !== undefined && typeof value === "string") {
    return enumLabel(labels[slugGroup], value);
  }
  const listGroup = LIST_LABEL_GROUPS[field];
  if (listGroup !== undefined && Array.isArray(value)) {
    return value.map((slug) => enumLabel(labels[listGroup], String(slug))).join(", ");
  }
  if (field === "publicCode" && typeof value === "string") {
    return formatPrintingCode(value);
  }
  return formatFieldValue(value);
}
