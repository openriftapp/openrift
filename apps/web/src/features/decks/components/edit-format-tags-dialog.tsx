import { capitalize } from "@openrift/shared/strings";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { useFilterActions } from "@/features/cards/hooks/use-card-filters";
import { DeckFormDialog, DeckFormFooter } from "@/features/decks/components/deck-form-dialog";
import type { DeckFormControls } from "@/features/decks/components/deck-form-dialog";
import { TagMultiSelect } from "@/features/decks/components/format-tag-multi-select";
import { useUpdateDeck } from "@/features/decks/hooks/use-decks";
import { getFormatTagConfig } from "@/features/decks/lib/format-tag-config";
import type { FormatTagConfig } from "@/features/decks/lib/format-tag-config";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

interface FormatTagsFields {
  deckId: string;
  currentSlugs: string[];
}

/** Cards that no longer carry one of the new tags get flagged after save; they aren't removed automatically. */
export function EditFormatTagsDialog({
  format,
  open,
  onOpenChange,
  ...fields
}: FormatTagsFields & { format: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const config = getFormatTagConfig(format);
  if (!config) {
    return null;
  }
  return (
    <DeckFormDialog open={open} onOpenChange={onOpenChange}>
      {(controls) => <EditFormatTagsForm {...fields} config={config} {...controls} />}
    </DeckFormDialog>
  );
}

function EditFormatTagsForm({
  deckId,
  currentSlugs,
  config,
  onClose,
  onSavingChange,
}: FormatTagsFields & { config: FormatTagConfig } & DeckFormControls) {
  const updateDeck = useUpdateDeck({ inlineError: true });
  const { setArrayFilter } = useFilterActions();
  const [selected, setSelected] = useState<string[]>(currentSlugs);

  const handleSave = async () => {
    if (selected.length === 0) {
      return;
    }
    onSavingChange(true);
    const saved = await runReportedMutation(() =>
      updateDeck.mutateAsync({ deckId, formatConfig: { tagSlugs: selected } }),
    );
    onSavingChange(false);
    if (saved) {
      // Overwrites any narrower filter the user had set: re-picking format
      // defaults is expected to be a fresh start.
      setArrayFilter("customTags", selected);
      onClose();
    }
  };

  return (
    <DialogForm onSubmit={() => void handleSave()}>
      <DialogHeader>
        <DialogTitle>
          {m.decks_format_tag_change_title({ nounPlural: config.nounPlural })}
        </DialogTitle>
      </DialogHeader>
      <p className="text-muted-foreground text-sm">
        {m.decks_format_tag_change_description({ nounPlural: config.nounPlural })}
      </p>
      <div className="space-y-2">
        <Label htmlFor="edit-format-tag-picker">{capitalize(config.nounPlural)}</Label>
        <TagMultiSelect
          triggerId="edit-format-tag-picker"
          category={config.category}
          nounPlural={config.nounPlural}
          selected={selected}
          onChange={setSelected}
          triggerClassName="w-full"
        />
      </div>
      {updateDeck.isError && (
        <FieldError>{errorText(updateDeck.error, m.decks_dialog_details_save_failed())}</FieldError>
      )}
      <DeckFormFooter pending={updateDeck.isPending}>
        <Button pending={updateDeck.isPending} type="submit" disabled={selected.length === 0}>
          {m.common_save()}
        </Button>
      </DeckFormFooter>
    </DialogForm>
  );
}
