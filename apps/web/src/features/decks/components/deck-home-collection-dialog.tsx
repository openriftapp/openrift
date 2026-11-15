import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { CreateCollectionDialog } from "@/features/collections/components/create-collection-dialog";
import { useCollectionsList } from "@/features/collections/hooks/use-collections";
import { DeckFormDialog, DeckFormFooter } from "@/features/decks/components/deck-form-dialog";
import type { DeckFormControls } from "@/features/decks/components/deck-form-dialog";
import { useUpdateDeck } from "@/features/decks/hooks/use-decks";
import { sharedBoxWarning } from "@/features/decks/lib/deck-box-label";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

const NONE = "none";
const NEW = "new";

interface DeckHomeCollectionFields {
  deckId: string;
  currentCollectionId: string | null;
}

/**
 * Copies in the picked collection count as available for this deck even when
 * the collection is excluded from deck building. Only personal collections
 * are pickable; group binders are shared and can't be a deck's box.
 */
export function DeckHomeCollectionDialog({
  open,
  onOpenChange,
  ...fields
}: DeckHomeCollectionFields & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <DeckFormDialog open={open} onOpenChange={onOpenChange}>
      {(controls) => <DeckHomeCollectionForm {...fields} {...controls} />}
    </DeckFormDialog>
  );
}

function DeckHomeCollectionForm({
  deckId,
  currentCollectionId,
  onClose,
  onSavingChange,
}: DeckHomeCollectionFields & DeckFormControls) {
  const [value, setValue] = useState(currentCollectionId ?? NONE);
  const [createOpen, setCreateOpen] = useState(false);
  const updateDeck = useUpdateDeck({ inlineError: true });
  const collections = useCollectionsList();

  const pickable = (collections ?? []).filter(
    (collection) => collection.groupId === null || collection.id === currentCollectionId,
  );
  const items = [
    { value: NONE, label: m.decks_dialog_home_none() },
    ...pickable.map((collection) => ({
      value: collection.id,
      label:
        collection.groupId === null
          ? collection.name
          : m.decks_dialog_home_group_suffix({ name: collection.name }),
    })),
    { value: NEW, label: m.decks_dialog_home_new() },
  ];

  // A group binder the deck was linked to before the personal-only rule: shown
  // so the dialog can still name where the deck lives, but not re-selectable.
  const currentIsGroup = pickable.some(
    (collection) => collection.id === currentCollectionId && collection.groupId !== null,
  );
  const selected = pickable.find((collection) => collection.id === value);
  const warning = selected
    ? sharedBoxWarning(
        selected.name,
        selected.homeDecks.filter((deck) => deck.id !== deckId),
      )
    : undefined;

  const save = async (next: string | null) => {
    if (next === currentCollectionId) {
      onClose();
      return;
    }
    onSavingChange(true);
    const saved = await runReportedMutation(() =>
      updateDeck.mutateAsync({ deckId, collectionId: next }),
    );
    onSavingChange(false);
    if (saved) {
      onClose();
    }
  };

  return (
    <>
      <DialogForm onSubmit={() => void save(value === NONE ? null : value)}>
        <DialogHeader>
          <DialogTitle>{m.decks_dialog_home_title()}</DialogTitle>
          <DialogDescription>{m.decks_dialog_home_description()}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deck-home-collection">{m.decks_dialog_home_label()}</Label>
          <SimpleSelect
            id="deck-home-collection"
            items={items.map((item) => ({
              ...item,
              disabled: currentIsGroup && item.value === currentCollectionId,
            }))}
            value={value}
            onChange={(next) => {
              // "New deck box…" is an action, not a value: leave the current
              // pick alone and let the create dialog decide the new one.
              if (next === NEW) {
                setCreateOpen(true);
                return;
              }
              setValue(next);
            }}
            disabled={!collections}
            className="w-full"
          />
          {warning && <p className="text-muted-foreground text-xs">{warning}</p>}
        </div>

        {updateDeck.isError && (
          <FieldError>
            {errorText(updateDeck.error, m.decks_dialog_details_save_failed())}
          </FieldError>
        )}

        <DeckFormFooter pending={updateDeck.isPending}>
          <Button type="submit" pending={updateDeck.isPending}>
            {m.common_save()}
          </Button>
        </DeckFormFooter>
      </DialogForm>
      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={m.decks_dialog_home_create_title()}
        description={m.decks_dialog_home_create_description()}
        availableForDeckbuilding={false}
        onCreated={(collectionId) => {
          setValue(collectionId);
          void save(collectionId);
        }}
      />
    </>
  );
}
