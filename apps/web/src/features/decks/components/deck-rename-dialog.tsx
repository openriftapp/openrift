import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeckFormDialog, DeckFormFooter } from "@/features/decks/components/deck-form-dialog";
import type { DeckFormControls } from "@/features/decks/components/deck-form-dialog";
import { useUpdateDeckMeta } from "@/features/decks/hooks/use-decks";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

interface DeckRenameFields {
  deckId: string;
  currentName: string;
}

function DeckRenameForm({
  deckId,
  currentName,
  onClose,
  onSavingChange,
}: DeckRenameFields & DeckFormControls) {
  const [draft, setDraft] = useState(currentName);
  const updateMeta = useUpdateDeckMeta(deckId, { inlineError: true });

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === currentName) {
      onClose();
      return;
    }
    onSavingChange(true);
    const saved = await runReportedMutation(() => updateMeta.save({ name: trimmed }));
    onSavingChange(false);
    if (saved) {
      onClose();
    }
  };

  return (
    <DialogForm onSubmit={() => void handleSubmit()}>
      <DialogHeader>
        <DialogTitle>{m.decks_dialog_rename_title()}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="deck-rename-name">{m.common_name()}</Label>
        <Input
          id="deck-rename-name"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={200}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- intentional: dialog input should grab focus
          autoFocus
        />
      </div>
      {updateMeta.isError && (
        <FieldError>{errorText(updateMeta.error, m.decks_dialog_details_save_failed())}</FieldError>
      )}
      <DeckFormFooter pending={updateMeta.isPending}>
        <Button type="submit" disabled={!draft.trim()} pending={updateMeta.isPending}>
          {m.common_save()}
        </Button>
      </DeckFormFooter>
    </DialogForm>
  );
}

export function DeckRenameDialog({
  open,
  onOpenChange,
  ...fields
}: DeckRenameFields & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <DeckFormDialog open={open} onOpenChange={onOpenChange}>
      {(controls) => <DeckRenameForm {...fields} {...controls} />}
    </DeckFormDialog>
  );
}
