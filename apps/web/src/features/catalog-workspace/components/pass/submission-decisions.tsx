import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { MoveSubmissionDialog } from "@/features/admin/components/move-submission-dialog";
import type { MovedCardDestination } from "@/features/admin/components/move-submission-dialog";
import { RejectSubmissionDialog } from "@/features/admin/components/reject-submission-dialog";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { passContributor } from "@/features/catalog-workspace/lib/card-pass";

export const workspaceCardDestination: MovedCardDestination = (cardSlug) => ({
  to: "/admin/workspace/cards/$cardSlug",
  params: { cardSlug },
  ignoreBlocker: true,
});

export interface SubmissionDecisions {
  onReject: (candidateCardId: string, kindLabel: string) => void;
  onMove?: (candidateCardId: string) => void;
  onMarkApplied: (candidateCardId: string) => void;
  dialogs: ReactNode;
}

export function useSubmissionDecisions({
  cardSlug,
  detail,
  submissions,
  isAdmin,
}: {
  cardSlug: string;
  detail: AdminCardDetailResponse;
  submissions: readonly AttentionSubmission[];
  isAdmin: boolean;
}): SubmissionDecisions {
  const queueWrite = useQueueWorkspaceWrite();
  const markApplied = useAcceptSubmission({ cardSlug });
  const [rejecting, setRejecting] = useState<{ candidateCardId: string; kindLabel: string } | null>(
    null,
  );
  const [movingId, setMovingId] = useState<string | null>(null);
  const nameOf = (candidateCardId: string) =>
    passContributor(detail, submissions, candidateCardId).name;

  return {
    onReject: (candidateCardId, kindLabel) => setRejecting({ candidateCardId, kindLabel }),
    onMove: isAdmin ? (candidateCardId) => setMovingId(candidateCardId) : undefined,
    onMarkApplied: (candidateCardId) =>
      void queueWrite(async (signal) => {
        await markApplied.mutateAsync({ candidateCardId, markApplied: true }, { signal });
        toast.success(`Marked ${nameOf(candidateCardId)}'s contribution as applied`);
      }),
    dialogs: (
      <>
        <RejectSubmissionDialog
          candidateCardId={rejecting?.candidateCardId ?? null}
          submitterName={rejecting === null ? null : nameOf(rejecting.candidateCardId)}
          kindLabel={rejecting?.kindLabel ?? "Correction"}
          scope={{ cardSlug }}
          runWrite={queueWrite}
          onOpenChange={(open) => {
            if (!open) {
              setRejecting(null);
            }
          }}
        />
        <MoveSubmissionDialog
          candidateCardId={movingId}
          submitterName={movingId === null ? null : nameOf(movingId)}
          scope={{ cardSlug }}
          runWrite={queueWrite}
          cardDestination={workspaceCardDestination}
          onOpenChange={(open) => {
            if (!open) {
              setMovingId(null);
            }
          }}
        />
      </>
    ),
  };
}
