import type {
  AdminCardDetailResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

type CandidateGroupInput = Pick<
  AdminCardDetailResponse,
  "candidatePrintings" | "candidatePrintingGroups"
>;

export function unlinkedCandidatesForSource(
  detail: Pick<AdminCardDetailResponse, "candidatePrintings">,
  candidateCardId: string,
): CandidatePrintingResponse[] {
  return detail.candidatePrintings.filter(
    (candidate) => candidate.candidateCardId === candidateCardId && candidate.printingId === null,
  );
}

export function unlinkedGroupCandidates(
  detail: CandidateGroupInput,
  candidatePrintingId: string,
): CandidatePrintingResponse[] {
  const byId = new Map(detail.candidatePrintings.map((candidate) => [candidate.id, candidate]));
  const group = detail.candidatePrintingGroups.find((entry) =>
    entry.shortCodes.includes(candidatePrintingId),
  );
  const ids = group?.shortCodes ?? [candidatePrintingId];
  return ids.flatMap((id) => {
    const candidate = byId.get(id);
    return candidate === undefined || candidate.printingId !== null ? [] : [candidate];
  });
}

export function linkedGroupCandidateIds(
  detail: Pick<AdminCardDetailResponse, "candidatePrintings">,
  candidateCardId: string,
  printingId: string,
): string[] {
  return detail.candidatePrintings
    .filter(
      (candidate) =>
        candidate.candidateCardId === candidateCardId && candidate.printingId === printingId,
    )
    .map((candidate) => candidate.id);
}
