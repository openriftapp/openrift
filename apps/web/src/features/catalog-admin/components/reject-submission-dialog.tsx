import type { CardSubmissionReason } from "@openrift/shared/contracts/card-submissions";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { SettleScope } from "@/features/catalog-admin/hooks/use-catalog-review";
import { useRejectSubmission } from "@/features/catalog-admin/hooks/use-catalog-review";

const REASON_ORDER: readonly CardSubmissionReason[] = [
  "duplicate",
  "already_correct",
  "unverified",
  "not_a_card",
  "bad_image",
  "other",
];

const REASON_LABELS: Record<CardSubmissionReason, string> = {
  duplicate: "Duplicate of a change already made",
  already_correct: "Already correct on the site",
  unverified: "Could not verify",
  not_a_card: "Not a Riftbound card",
  bad_image: "Image unusable",
  other: "Other",
};

const DEFAULT_REASON: CardSubmissionReason = "unverified";

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
  const [reason, setReason] = useState<CardSubmissionReason>(DEFAULT_REASON);
  const [note, setNote] = useState("");

  const trimmedNote = note.trim();
  const notePayload = trimmedNote === "" ? null : trimmedNote;
  const who = submitterName ?? "this contributor";

  async function handleSubmit() {
    if (candidateCardId === null) {
      return;
    }
    try {
      await rejectSubmission.mutateAsync({ candidateCardId, reason, note: notePayload });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    setReason(DEFAULT_REASON);
    setNote("");
    onOpenChange(false);
    onRejected?.();
  }

  return (
    <Dialog open={candidateCardId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => void handleSubmit()}>
          <DialogHeader>
            <DialogTitle>
              Reject {who}
              {submitterName === null ? "" : "'s"} {kindLabel.toLowerCase()}
            </DialogTitle>
            <DialogDescription>
              The contributor sees the reason you pick, plus your message if you write one.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Reason</Label>
              <RadioGroup
                value={reason}
                aria-label="Reason"
                className="flex flex-col gap-2"
                onValueChange={(next) => {
                  const match = REASON_ORDER.find((option) => option === next);
                  if (match) {
                    setReason(match);
                  }
                }}
              >
                {REASON_ORDER.map((option) => {
                  const radioId = `catalog-reject-${option}`;
                  return (
                    <div key={option} className="flex items-center gap-2">
                      <RadioGroupItem id={radioId} value={option} />
                      <label htmlFor={radioId} className="cursor-pointer">
                        {REASON_LABELS[option]}
                      </label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catalog-reject-note">Message (optional)</Label>
              <Textarea
                id="catalog-reject-note"
                value={note}
                maxLength={2000}
                rows={3}
                placeholder="Where did you check, and what did you find?"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" disabled={rejectSubmission.isPending}>
              Reject &amp; notify
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
