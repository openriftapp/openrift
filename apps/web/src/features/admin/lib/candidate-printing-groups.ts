import type {
  CandidatePrintingGroupResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";

export interface PrintingGroup {
  candidates: CandidatePrintingResponse[];
  expectedPrintingId: string;
  language: string | null;
  suggestedPrintingId: string | null;
}

export function buildPrintingGroups(
  apiGroups: CandidatePrintingGroupResponse[],
  candidatePrintings: CandidatePrintingResponse[],
): (PrintingGroup & { groupKey: string })[] {
  const byId = new Map(candidatePrintings.map((ps) => [ps.id, ps]));
  return apiGroups.map((g, index) => {
    const candidates = g.shortCodes
      .map((id: string) => byId.get(id))
      .filter(Boolean) as CandidatePrintingResponse[];
    return {
      candidates,
      expectedPrintingId: g.expectedPrintingId,
      language: g.language,
      suggestedPrintingId: g.suggestedPrintingId,
      groupKey: candidates[0]?.id ?? `${g.expectedPrintingId}-${index}`,
    };
  });
}
