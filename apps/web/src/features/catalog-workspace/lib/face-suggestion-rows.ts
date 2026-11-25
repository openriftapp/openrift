import { pluralize } from "@openrift/shared/strings";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

import { imagesOnSide } from "@/features/admin/lib/printing-side-images";
import type { CompareContext } from "@/features/admin/lib/source-compare";
import {
  candidateBelongsToFace,
  candidateHasNewImage,
  FACE_FIELDS,
  isContributorProvider,
  PRINTING_FIELDS,
  printingDifferences,
  providerOf,
} from "@/features/admin/lib/source-compare";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";
import { printingFieldSuggestions } from "@/features/catalog-workspace/lib/suggestion-rows";

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
  suggestions: PrintingFieldSuggestion[];
  sources: SuggestionSource[];
  sourceImages: SourceImageCandidate[];
}

const FACE_FIELD_READING_ORDER: readonly string[] = [
  "shortCode",
  "publicCode",
  "setId",
  "language",
  "rarity",
  "finish",
  "artVariant",
  "markerSlugs",
  "isSigned",
  "isOvernumbered",
  "printedName",
  "printedRulesText",
  "printedEffectText",
  "flavorText",
  "artist",
  "printedYear",
];

export const FACE_FIELDS_FOR_READING = FACE_FIELDS.toSorted((a, b) => {
  const rank = (field: string) => {
    const index = FACE_FIELD_READING_ORDER.indexOf(field);
    return index === -1 ? FACE_FIELD_READING_ORDER.length : index;
  };
  return rank(a) - rank(b);
});

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

  const suggestions: PrintingFieldSuggestion[] = [];
  const sources: SuggestionSource[] = [];
  const sourceImages: SourceImageCandidate[] = [];

  for (const candidate of candidates) {
    const provider = providerOf(detail, candidate.candidateCardId);
    const isContributor = isContributorProvider(provider);
    const row = printings.find((entry) => entry.id === candidate.printingId) ?? face;
    const faceSuggestions = printingFieldSuggestions(
      candidate,
      row,
      FACE_FIELDS,
      context,
      provider,
    );
    const printingDiffs = printingDifferences(candidate, row, PRINTING_FIELDS, context).length;
    const hasImage = candidateHasNewImage(candidate, ownUrls, isContributor);
    if (hasImage) {
      sourceImages.push({ candidate, url: candidate.imageUrl as string, provider, isContributor });
    }
    suggestions.push(...faceSuggestions);
    const differences = faceSuggestions.length + (hasImage ? 1 : 0);
    sources.push({
      candidatePrintingId: candidate.id,
      candidateCardId: candidate.candidateCardId,
      provider,
      isContributor,
      differences,
      elsewhere: describeElsewhere({ printingFields: printingDiffs }),
    });
  }

  return {
    face,
    printings,
    images,
    suggestions,
    sources,
    sourceImages,
  };
}
