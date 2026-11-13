import type { CardSubmissionReason } from "@openrift/shared/contracts/card-submissions";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { SubmissionMessageFields } from "@/features/admin/components/submission-message-fields";
import {
  useSetSubmissionResolution,
  useSubmissionForCandidate,
} from "@/features/admin/hooks/use-admin-card-submissions";
import { CARD_NOTE_PLACEHOLDER, canSendRejection } from "@/features/admin/lib/submission-reasons";
import {
  submissionReasonLabels,
  submissionReasonSentences,
} from "@/features/contribute/lib/card-submission-copy";
import { runReportedMutation } from "@/lib/run-reported-mutation";

const REASON_ORDER: CardSubmissionReason[] = [
  "not_a_card",
  "duplicate",
  "already_correct",
  "unverified",
  "bad_image",
  "other",
];

// A function declared after the component's return bails the React Compiler out of the whole file.
function defaultReason(mode: "reject" | "reply"): CardSubmissionReason | null {
  return mode === "reject" ? "not_a_card" : null;
}

interface SubmissionResolutionDialogProps {
  candidateCardId: string | null;
  /** `reject` also ignores the candidate on confirm; `reply` only writes the message. */
  mode: "reject" | "reply";
  onOpenChange: (open: boolean) => void;
  onConfirmed?: () => void;
}

export function SubmissionResolutionDialog({
  candidateCardId,
  mode,
  onOpenChange,
  onConfirmed,
}: SubmissionResolutionDialogProps) {
  const { data } = useSubmissionForCandidate(candidateCardId);
  const setResolution = useSetSubmissionResolution();
  const existing = data?.submission ?? null;

  const [reason, setReason] = useState<CardSubmissionReason | null>(null);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const effectiveReason = touched ? reason : (existing?.reason ?? defaultReason(mode));
  const effectiveNote = touched ? note : (existing?.resolutionNote ?? "");

  // Resolved before the try: a ternary inside a try body bails the React Compiler.
  const trimmedNote = effectiveNote.trim();
  const notePayload = trimmedNote || null;
  const blocked = mode === "reject" && !canSendRejection(effectiveReason, effectiveNote);

  async function handleSubmit() {
    if (candidateCardId === null || blocked) {
      return;
    }
    if (
      !(await runReportedMutation(() =>
        setResolution.mutateAsync({
          candidateCardId,
          reason: effectiveReason,
          note: notePayload,
        }),
      ))
    ) {
      return;
    }
    setTouched(false);
    setNote("");
    onConfirmed?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={candidateCardId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => void handleSubmit()}>
          <DialogHeader>
            <DialogTitle>
              {mode === "reject" ? "Reject submission" : "Reply to contributor"}
            </DialogTitle>
            <DialogDescription>
              {mode === "reject"
                ? "This rejects the submission and tells the contributor why."
                : "The contributor sees this on their submissions page."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <SubmissionMessageFields
              idPrefix="submission"
              reasonOrder={REASON_ORDER}
              reasonLabels={submissionReasonLabels()}
              reasonSentences={submissionReasonSentences()}
              notePlaceholder={CARD_NOTE_PLACEHOLDER}
              reason={effectiveReason}
              note={effectiveNote}
              onReasonChange={(next) => {
                setTouched(true);
                setReason(next);
              }}
              onNoteChange={(next) => {
                setTouched(true);
                setNote(next);
              }}
            />
          </div>

          <DialogFooter>
            <DialogCancel />
            <Button
              type="submit"
              variant={mode === "reject" ? "destructive" : "default"}
              disabled={setResolution.isPending || blocked}
            >
              {mode === "reject" ? "Reject" : "Save"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
