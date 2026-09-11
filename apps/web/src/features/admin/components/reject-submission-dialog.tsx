import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Textarea } from "@/components/ui/textarea";
import type { SettleScope } from "@/features/admin/hooks/use-catalog-review";
import { useRejectSubmission } from "@/features/admin/hooks/use-catalog-review";

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
  const [note, setNote] = useState("");

  const trimmedNote = note.trim();
  const notePayload = trimmedNote === "" ? null : trimmedNote;
  const who = submitterName ?? "this contributor";

  async function handleSubmit() {
    if (candidateCardId === null) {
      return;
    }
    try {
      await rejectSubmission.mutateAsync({ candidateCardId, note: notePayload });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
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
          </DialogHeader>

          <div className="py-2">
            <Textarea
              value={note}
              maxLength={2000}
              rows={4}
              aria-label="Message to the contributor"
              placeholder="Tell the contributor why (optional)"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose>
            <Button type="submit" variant="destructive" disabled={rejectSubmission.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
