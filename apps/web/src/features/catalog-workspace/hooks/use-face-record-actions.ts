import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";

import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useSetCandidatePrintingImage } from "@/features/admin/hooks/use-admin-image-mutations";
import type { FieldAcceptMark } from "@/features/admin/lib/accept-undo";
import { IMAGE_FILE_SCOPE } from "@/features/admin/lib/admin-query-keys";
import type { StoredSourceImage } from "@/features/catalog-workspace/hooks/source-image-undo";
import { sourceImageUndo } from "@/features/catalog-workspace/hooks/source-image-undo";
import {
  useContributorAccept,
  usePrintingSuggestionApply,
} from "@/features/catalog-workspace/hooks/use-suggestion-writes";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import {
  queuedFieldWrite,
  useQueueWorkspaceWrite,
} from "@/features/catalog-workspace/hooks/workspace-writes";
import type { SourceImageCandidate } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { cardRecordScope } from "@/features/catalog-workspace/lib/record-scopes";
import type { PrintingFieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";
import { runReportedMutation } from "@/lib/run-reported-mutation";

export type FaceChip =
  | { kind: "image"; key: string; image: SourceImageCandidate }
  | { kind: "field"; key: string; suggestion: PrintingFieldSuggestion };

export function useFaceSuggestionWrites({
  cardSlug,
  record,
  face,
  contributorName,
}: {
  cardSlug: string;
  record: string;
  face: AdminPrintingResponse | null;
  contributorName: (candidateCardId: string) => string;
}) {
  const scope = cardRecordScope(cardSlug);
  const queue = useQueueWorkspaceWrite();
  const fields = usePrintingSuggestionApply({
    scope,
    record,
    cardSlug,
    printing: face,
    contributorName,
  });
  const contributor = useContributorAccept(scope, cardSlug);
  const setCandidateImage = useSetCandidatePrintingImage(IMAGE_FILE_SCOPE);
  const { data: access } = useAdminAccess();
  const { announce } = useWorkspaceUndo();

  async function applyImage(signal: AbortSignal, image: SourceImageCandidate): Promise<void> {
    if (image.isContributor) {
      if (face) {
        await contributor.accept(
          signal,
          {
            candidateCardId: image.candidate.candidateCardId,
            images: [
              { candidatePrintingId: image.candidate.id, printingId: face.id, faceId: face.faceId },
            ],
          },
          contributorName(image.candidate.candidateCardId),
        );
      }
      return;
    }
    let stored: StoredSourceImage | undefined;
    const ok = await runReportedMutation(async () => {
      stored = await setCandidateImage.mutateAsync(
        { candidatePrintingId: image.candidate.id, mode: "main" },
        { signal },
      );
    });
    const entry =
      ok && stored && access?.isAdmin === true
        ? sourceImageUndo(stored, "main", record, IMAGE_FILE_SCOPE)
        : null;
    if (entry !== null) {
      announce(entry);
    }
  }

  function applyChip(signal: AbortSignal, mark: FieldAcceptMark, chip: FaceChip): Promise<void> {
    return chip.kind === "image"
      ? applyImage(signal, chip.image)
      : fields.apply(signal, chip.suggestion, mark);
  }

  return {
    apply: queuedFieldWrite(queue, applyChip),
    pending: fields.pending || contributor.pending || setCandidateImage.isPending,
  };
}
