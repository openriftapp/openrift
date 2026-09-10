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
import {
  useSetSubmissionResolution,
  useSubmissionForCandidate,
} from "@/features/admin/hooks/use-admin-card-submissions";

interface SendNoteDialogProps {
  candidateCardId: string | null;
  submitterName: string | null;
  onOpenChange: (open: boolean) => void;
}

export function SendNoteDialog({
  candidateCardId,
  submitterName,
  onOpenChange,
}: SendNoteDialogProps) {
  const { data } = useSubmissionForCandidate(candidateCardId);
  const setResolution = useSetSubmissionResolution();
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const existing = data?.submission ?? null;
  const effectiveNote = touched ? note : (existing?.resolutionNote ?? "");
  const trimmedNote = effectiveNote.trim();
  const notePayload = trimmedNote === "" ? null : trimmedNote;
  const who = submitterName ?? "the contributor";

  async function handleSubmit() {
    if (candidateCardId === null) {
      return;
    }
    const payload = { candidateCardId, reason: existing?.reason ?? null, note: notePayload };
    try {
      await setResolution.mutateAsync(payload);
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    setTouched(false);
    setNote("");
    onOpenChange(false);
  }

  return (
    <Dialog open={candidateCardId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => void handleSubmit()}>
          <DialogHeader>
            <DialogTitle>Note to {who}</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <Textarea
              value={effectiveNote}
              maxLength={2000}
              rows={4}
              aria-label={`Note to ${who}`}
              onChange={(event) => {
                setTouched(true);
                setNote(event.target.value);
              }}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={setResolution.isPending}>
              Send
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
