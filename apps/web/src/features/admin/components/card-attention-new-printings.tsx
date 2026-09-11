import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";

import { Button } from "@/components/ui/button";
import { PrintingIdLabel } from "@/features/admin/components/printing-id-label";
import { buildPrintingGroups } from "@/features/admin/lib/candidate-printing-groups";

export function CardAttentionNewPrintings({
  detail,
  candidateCardId,
  onOpen,
}: {
  detail: AdminCardDetailResponse;
  candidateCardId: string;
  onOpen: (candidatePrintingId: string) => void;
}) {
  const groups = buildPrintingGroups(
    detail.candidatePrintingGroups,
    detail.candidatePrintings,
  ).filter((group) =>
    group.candidates.some((candidate) => candidate.candidateCardId === candidateCardId),
  );

  if (groups.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {groups.map((group) => (
        <li key={group.groupKey}>
          <Button variant="link" onClick={() => onOpen(group.candidates[0]?.id ?? group.groupKey)}>
            <PrintingIdLabel label={group.expectedPrintingId} language={group.language} />
          </Button>
        </li>
      ))}
    </ul>
  );
}
