import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  AdminCardDetailResponse,
  AdminMarketplaceName,
  AdminPrintingResponse,
  CandidatePrintingResponse,
  StagedProductResponse,
} from "@openrift/shared/types/api/admin";

import { imagesOnSide } from "@/features/admin/lib/printing-side-images";
import type {
  CompareContext,
  FieldSuggestion,
  SuggestionSource,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import {
  candidateBelongsToFace,
  candidateHasNewImage,
  compareCandidate,
  describeElsewhere,
  FACE_FIELDS,
  PRINTING_FIELDS,
  providerOf,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";

export interface PrintingSuggestionModel {
  printing: AdminPrintingResponse | null;
  suggestions: FieldSuggestion[];
  sources: SuggestionSource[];
  agreeingFields: number;
  enterCandidateIds: string[];
}

export function buildPrintingSuggestions(
  details: readonly AdminCardDetailResponse[],
  printingId: string,
  context: CompareContext,
): PrintingSuggestionModel {
  const printing =
    details.flatMap((detail) => detail.printings).find((row) => row.id === printingId) ?? null;
  if (printing === null) {
    return { printing, suggestions: [], sources: [], agreeingFields: 0, enterCandidateIds: [] };
  }

  const hidden = context.hiddenProviders ?? new Set<string>();
  const seen = new Set<string>();
  const suggestions: FieldSuggestion[] = [];
  const sources: SuggestionSource[] = [];
  const enterCandidateIds: string[] = [];
  let agreeingFields = 0;

  for (const detail of details) {
    for (const candidate of detail.candidatePrintings) {
      if (
        candidate.printingId !== printingId ||
        candidate.checkedAt !== null ||
        seen.has(candidate.id)
      ) {
        continue;
      }
      const provider = providerOf(detail, candidate.candidateCardId);
      if (hidden.has(provider)) {
        continue;
      }
      seen.add(candidate.id);
      const compared = compareCandidate(candidate, printing, PRINTING_FIELDS, context, provider);
      agreeingFields = Math.max(agreeingFields, compared.agreeing);
      const isContributor = provider === USER_SUBMISSION_PROVIDER;
      const onFace = detail.printings.find(
        (row) =>
          row.id === printingId && candidateBelongsToFace(candidate, row.faceId, detail.printings),
      );
      const faceFields =
        onFace === undefined
          ? 0
          : compareCandidate(candidate, onFace, FACE_FIELDS, context, provider).suggestions.length;
      const ownUrls = new Set(
        onFace === undefined
          ? []
          : imagesOnSide(detail.printingImages, onFace).map((image) => image.originalUrl),
      );
      const images = onFace !== undefined && candidateHasNewImage(candidate, ownUrls) ? 1 : 0;
      sources.push({
        candidatePrintingId: candidate.id,
        candidateCardId: candidate.candidateCardId,
        provider,
        isContributor,
        differences: compared.suggestions.length,
        elsewhere: describeElsewhere({ faceFields, images }),
      });
      suggestions.push(...compared.suggestions);
      if (!isContributor && compared.suggestions.length > 0 && faceFields === 0 && images === 0) {
        enterCandidateIds.push(candidate.id);
      }
    }
  }

  return { printing, suggestions, sources, agreeingFields, enterCandidateIds };
}

export interface PrintingCompareGroup {
  detail: AdminCardDetailResponse;
  face: AdminPrintingResponse;
  candidates: CandidatePrintingResponse[];
}

export function printingCompareGroups(
  details: readonly AdminCardDetailResponse[],
  printingId: string,
  hiddenProviders: ReadonlySet<string> = new Set(),
): PrintingCompareGroup[] {
  const groups: PrintingCompareGroup[] = [];
  const seenFaces = new Set<string>();
  for (const detail of details) {
    for (const face of detail.printings) {
      if (face.id !== printingId || seenFaces.has(face.faceId)) {
        continue;
      }
      seenFaces.add(face.faceId);
      const candidates = detail.candidatePrintings.filter(
        (candidate) =>
          candidate.printingId === printingId &&
          !hiddenProviders.has(providerOf(detail, candidate.candidateCardId)) &&
          candidateBelongsToFace(candidate, face.faceId, detail.printings),
      );
      groups.push({ detail, face, candidates });
    }
  }
  return groups.toSorted((a, b) => a.face.side - b.face.side);
}

export interface ListingSuggestion {
  key: string;
  marketplace: AdminMarketplaceName;
  product: StagedProductResponse;
  score: number;
}

interface ListingEntry {
  marketplace: AdminMarketplaceName;
  product: StagedProductResponse;
  isAssigned: boolean;
}

export function listingSuggestionsForPrinting(
  entries: readonly ListingEntry[],
  suggestions: ReadonlyMap<string, readonly { printingId: string; score: number }[]>,
  keyOf: (entry: ListingEntry) => string,
  printingId: string,
): ListingSuggestion[] {
  return entries
    .filter((entry) => !entry.isAssigned)
    .flatMap((entry) => {
      const key = keyOf(entry);
      const match = suggestions
        .get(key)
        ?.find((suggestion) => suggestion.printingId === printingId);
      return match === undefined
        ? []
        : [{ key, marketplace: entry.marketplace, product: entry.product, score: match.score }];
    })
    .toSorted((a, b) => b.score - a.score);
}
