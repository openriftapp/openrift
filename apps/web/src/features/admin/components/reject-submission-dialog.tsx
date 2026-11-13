import type { CardSubmissionReason } from "@openrift/shared/contracts/card-submissions";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { SubmissionMessageFields } from "@/features/admin/components/submission-message-fields";
import type { SettleScope } from "@/features/admin/hooks/use-catalog-review";
import { useRejectSubmission } from "@/features/admin/hooks/use-catalog-review";
import {
  CARD_NOTE_PLACEHOLDER,
  REJECT_REASON_ORDER,
  canSendRejection,
} from "@/features/admin/lib/submission-reasons";
import {
  submissionReasonLabels,
  submissionReasonSentences,
} from "@/features/contribute/lib/card-submission-copy";
import { runReportedMutation } from "@/lib/run-reported-mutation";

interface RejectSubmissionDialogProps {
  candidateCardId: string | null;
  submitterName: string | null;
  kindLabel: string;
  scope?: SettleScope;
  onOpenChange: (open: boolean) => void;
  onRejected?: () => void;
}

export function RejectSubmissionDialog({
  candidateCardId,
  submitterName,
  kindLabel,
  scope,
  onOpenChange,
  onRejected,
}: RejectSubmissionDialogProps) {
  const rejectSubmission = useRejectSubmission(scope);
  const [reason, setReason] = useState<CardSubmissionReason | null>(null);
  const [note, setNote] = useState("");

  const trimmedNote = note.trim();
  const notePayload = trimmedNote === "" ? null : trimmedNote;
  const who = submitterName ?? "this contributor";
  const ready = canSendRejection(reason, note);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setReason(null);
      setNote("");
    }
    onOpenChange(open);
  }

  async function handleSubmit() {
    if (candidateCardId === null || reason === null || !ready) {
      return;
    }
    if (
      !(await runReportedMutation(() =>
        rejectSubmission.mutateAsync({ candidateCardId, reason, note: notePayload }),
      ))
    ) {
      return;
    }
    handleOpenChange(false);
    onRejected?.();
  }

  return (
    <Dialog open={candidateCardId !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => void handleSubmit()}>
          <DialogHeader>
            <DialogTitle>
              Reject {who}
              {submitterName === null ? "" : "'s"} {kindLabel.toLowerCase()}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <SubmissionMessageFields
              idPrefix="reject"
              reasonOrder={REJECT_REASON_ORDER}
              reasonLabels={submissionReasonLabels()}
              reasonSentences={submissionReasonSentences()}
              notePlaceholder={CARD_NOTE_PLACEHOLDER}
              reason={reason}
              note={note}
              onReasonChange={setReason}
              onNoteChange={setNote}
            />
          </div>

          <DialogFooter>
            <DialogCancel />
            <Button
              type="submit"
              variant="destructive"
              disabled={rejectSubmission.isPending || !ready}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
