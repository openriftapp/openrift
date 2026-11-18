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
import { Textarea } from "@/components/ui/textarea";
import {
  useSetSubmissionResolution,
  useSubmissionForCandidate,
} from "@/features/admin/hooks/use-admin-card-submissions";
import type { RunWrite } from "@/features/admin/lib/run-write";
import { runWriteDirectly } from "@/features/admin/lib/run-write";

interface SendNoteDialogProps {
  candidateCardId: string | null;
  submitterName: string | null;
  onOpenChange: (open: boolean) => void;
  runWrite?: RunWrite;
}

export function SendNoteDialog({
  candidateCardId,
  submitterName,
  onOpenChange,
  runWrite = runWriteDirectly,
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
    if (!(await runWrite((signal) => setResolution.mutateAsync(payload, { signal })))) {
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
            <DialogCancel />
            <Button type="submit" pending={setResolution.isPending}>
              Send
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
