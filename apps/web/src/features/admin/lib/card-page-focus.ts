import type {
  AdminCardDetailResponse,
  AdminMarketplaceName,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";

import { buildPrintingGroups } from "@/features/admin/lib/candidate-printing-groups";

export const NEEDS_DECISION_ID = "needs-decision";

export function cardFoldKeys(detail: AdminCardDetailResponse): string[] {
  const groups = buildPrintingGroups(detail.candidatePrintingGroups, detail.candidatePrintings);
  return [...new Set(detail.printings.map((p) => p.faceId)), ...groups.map((g) => g.groupKey)];
}

export function foldsFocusing(
  detail: AdminCardDetailResponse,
  faceIds: readonly string[],
): Set<string> {
  return new Set(cardFoldKeys(detail).filter((key) => !faceIds.includes(key)));
}

export function hasFace(detail: AdminCardDetailResponse, faceId: string): boolean {
  return detail.printings.some((printing) => printing.faceId === faceId);
}

// Cardmarket rows apply to all siblings, so any matching finish works there;
// other marketplaces also require a language match.
export function marketplaceFocusFace(
  printings: readonly AdminPrintingResponse[],
  marketplace: AdminMarketplaceName,
  finish: string,
  language?: string,
): string | null {
  const isLanguageAggregate = marketplace === "cardmarket";
  const match =
    printings.find(
      (p) => p.finish === finish && (isLanguageAggregate || !language || p.language === language),
    ) ??
    printings.find((p) => p.finish === finish) ??
    null;
  return match?.faceId ?? null;
}

export function candidateGroupKey(
  detail: AdminCardDetailResponse,
  candidatePrintingId: string,
): string | null {
  const group = buildPrintingGroups(detail.candidatePrintingGroups, detail.candidatePrintings).find(
    (entry) => entry.candidates.some((candidate) => candidate.id === candidatePrintingId),
  );
  return group?.groupKey ?? null;
}

/** One attempt on the next frame; a target missing then is not retried. */
export function scrollIntoViewNextFrame(selector: string, block: ScrollLogicalPosition): void {
  requestAnimationFrame(() => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block });
  });
}

export function scrollToFace(faceId: string | undefined): void {
  if (faceId !== undefined) {
    scrollIntoViewNextFrame(`[data-face-id="${faceId}"]`, "center");
  }
}
