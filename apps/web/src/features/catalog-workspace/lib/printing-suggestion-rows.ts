import { hasFieldValue } from "@openrift/shared/catalog-field-compare";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

import type { CompareContext } from "@/features/admin/lib/source-compare";
import {
  candidateFaceRow,
  candidateBelongsToFace,
  candidateHasNewImage,
  FACE_FIELDS,
  isContributorProvider,
  ownImageUrls,
  PRINTING_FIELDS,
  printingDifferences,
  providerOf,
} from "@/features/admin/lib/source-compare";
import type { SuggestionSource } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { describeElsewhere } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";
import { printingFieldSuggestions } from "@/features/catalog-workspace/lib/suggestion-rows";

export interface PrintingSuggestionModel {
  printing: AdminPrintingResponse | null;
  suggestions: PrintingFieldSuggestion[];
  sources: SuggestionSource[];
}

export function buildPrintingSuggestions(
  details: readonly AdminCardDetailResponse[],
  printingId: string,
  context: CompareContext,
): PrintingSuggestionModel {
  const printing =
    details.flatMap((detail) => detail.printings).find((row) => row.id === printingId) ?? null;
  if (printing === null) {
    return { printing, suggestions: [], sources: [] };
  }

  const hidden = context.hiddenProviders ?? new Set<string>();
  const seen = new Set<string>();
  const suggestions: PrintingFieldSuggestion[] = [];
  const sources: SuggestionSource[] = [];

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
      const compared = printingFieldSuggestions(
        candidate,
        printing,
        PRINTING_FIELDS,
        context,
        provider,
      );
      const onFace = candidateFaceRow(candidate, detail.printings);
      const faceFields =
        onFace === undefined
          ? 0
          : printingDifferences(candidate, onFace, FACE_FIELDS, context).length;
      const images =
        onFace !== undefined &&
        candidateHasNewImage(
          candidate,
          ownImageUrls(detail.printingImages, onFace),
          isContributorProvider(provider),
        )
          ? 1
          : 0;
      sources.push({
        candidatePrintingId: candidate.id,
        candidateCardId: candidate.candidateCardId,
        provider,
        isContributor: isContributorProvider(provider),
        differences: compared.length,
        elsewhere: describeElsewhere({ faceFields, images }),
      });
      suggestions.push(...compared);
    }
  }

  return { printing, suggestions, sources };
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

export function sourcesReportPrintingFields(
  details: readonly AdminCardDetailResponse[],
  printingId: string,
  hiddenProviders: ReadonlySet<string> = new Set(),
): boolean {
  return printingCompareGroups(details, printingId, hiddenProviders).some((group) =>
    group.candidates.some((candidate) =>
      PRINTING_FIELDS.some((field) => hasFieldValue((candidate as Record<string, unknown>)[field])),
    ),
  );
}
