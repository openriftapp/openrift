import { MAX_COPIES_PER_ADD } from "@openrift/shared/contracts/copies";
import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import type { Printing } from "@openrift/shared/types/catalog";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenIcon, CheckIcon, InboxIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { PickerList, PickerRow } from "@/components/ui/picker-list";
import { QuantityStepperField } from "@/components/ui/quantity-stepper";
import { ImportPrintingLabel } from "@/features/cards/components/printing-label";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCollections } from "@/features/collections/hooks/use-collections";
import { useAddCopies } from "@/features/collections/hooks/use-copies";
import type {
  AddEntryToCollectionRequest,
  AddEntryToCollectionSubject,
} from "@/features/lists/lib/list-move";
import { listsKeys } from "@/features/lists/lib/lists-query-keys";
import { useUserId } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const SELECTED_ROW =
  "bg-primary/10 text-primary data-selected:bg-primary/10 data-selected:text-primary data-selected:**:text-primary";

interface AddEntryToCollectionDialogBodyProps {
  subject: AddEntryToCollectionSubject;
  fixedCollection?: CollectionResponse;
  collections: CollectionResponse[];
  printings: Printing[];
  onConfirm: (input: { printingId: string; collectionId: string; quantity: number }) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function AddEntryToCollectionDialogBody({
  subject,
  fixedCollection,
  collections,
  printings,
  onConfirm,
  onCancel,
  isPending,
}: AddEntryToCollectionDialogBodyProps) {
  const [printingHighlight, setPrintingHighlight] = useState("");
  const [collectionHighlight, setCollectionHighlight] = useState("");
  const [printingId, setPrintingId] = useState(subject.printing.id);
  const [collectionId, setCollectionId] = useState(
    () =>
      fixedCollection?.id ??
      collections.find((collection) => collection.isInbox)?.id ??
      collections.at(0)?.id ??
      null,
  );
  const [quantity, setQuantity] = useState(() =>
    Math.min(Math.max(subject.totalQuantity, 1), MAX_COPIES_PER_ADD),
  );

  const canConfirm = !isPending && collectionId !== null;
  const submit = () => {
    if (!isPending && collectionId !== null) {
      onConfirm({ printingId, collectionId, quantity });
    }
  };

  return (
    <DialogForm onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>
          {fixedCollection
            ? m.lists_add_to_collection_title_named({ collection: fixedCollection.name })
            : m.lists_add_to_collection_title()}
        </DialogTitle>
        <DialogDescription>
          {m.lists_add_to_collection_note({ card: subject.cardName })}
        </DialogDescription>
      </DialogHeader>
      {subject.sourceKind === "card" && printings.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm">{m.lists_add_to_collection_pick_printing()}</p>
          <PickerList highlightedId={printingHighlight} onHighlightChange={setPrintingHighlight}>
            {printings.map((printing) => (
              <PickerRow
                key={printing.id}
                value={printing.id}
                onSelect={() => setPrintingId(printing.id)}
                className={cn("px-3 py-2", printingId === printing.id && SELECTED_ROW)}
              >
                <ImportPrintingLabel printing={printing} className="min-w-0 flex-1 truncate" />
                {printingId === printing.id && <CheckIcon className="size-4 shrink-0" />}
              </PickerRow>
            ))}
          </PickerList>
        </div>
      )}
      {!fixedCollection &&
        (collections.length === 0 ? (
          <Empty>
            <EmptyDescription>{m.collections_dialog_move_empty()}</EmptyDescription>
          </Empty>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">{m.lists_add_to_collection_pick_collection()}</p>
            <PickerList
              highlightedId={collectionHighlight}
              onHighlightChange={setCollectionHighlight}
            >
              {collections.map((collection) => (
                <PickerRow
                  key={collection.id}
                  value={collection.id}
                  keywords={[collection.name]}
                  onSelect={() => setCollectionId(collection.id)}
                  className={cn("px-3 py-2", collectionId === collection.id && SELECTED_ROW)}
                >
                  {collection.isInbox ? (
                    <InboxIcon className="size-4 shrink-0" />
                  ) : (
                    <BookOpenIcon className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{collection.name}</span>
                  {collectionId === collection.id && <CheckIcon className="size-4 shrink-0" />}
                </PickerRow>
              ))}
            </PickerList>
          </div>
        ))}
      <QuantityStepperField
        label={m.lists_add_to_collection_quantity()}
        value={quantity}
        onValueChange={setQuantity}
        max={MAX_COPIES_PER_ADD}
        editable
        disabled={isPending}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          {m.common_cancel()}
        </Button>
        <Button type="submit" disabled={!canConfirm}>
          {isPending ? m.lists_add_to_collection_pending() : m.lists_add_to_collection_confirm()}
        </Button>
      </div>
    </DialogForm>
  );
}

function ConnectedBody({
  request,
  listId,
  onClose,
}: {
  request: AddEntryToCollectionRequest;
  listId?: string;
  onClose: () => void;
}) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { data: collections } = useCollections();
  const { printingsByCardId } = useCards();
  const addCopies = useAddCopies();
  const { subject } = request;
  const printings =
    subject.sourceKind === "card"
      ? (printingsByCardId.get(subject.printing.cardId) ?? [subject.printing])
      : [subject.printing];
  const fixedCollection =
    request.collectionId === undefined
      ? undefined
      : collections.find((collection) => collection.id === request.collectionId);

  const handleConfirm = ({
    printingId,
    collectionId,
    quantity,
  }: {
    printingId: string;
    collectionId: string;
    quantity: number;
  }) => {
    const collectionName = collections.find((collection) => collection.id === collectionId)?.name;
    addCopies.mutate(
      { copies: Array.from({ length: quantity }, () => ({ printingId, collectionId })) },
      {
        onSuccess: () => {
          toast.success(
            m.lists_toast_added_to_collection({
              count: quantity,
              collection: collectionName ?? "",
            }),
          );
          onClose();
          if (userId) {
            void queryClient.invalidateQueries({
              queryKey: listId ? listsKeys.detail(userId, listId) : listsKeys.all(userId),
            });
          }
        },
      },
    );
  };

  return (
    <AddEntryToCollectionDialogBody
      subject={subject}
      fixedCollection={fixedCollection}
      collections={collections}
      printings={printings}
      onConfirm={handleConfirm}
      onCancel={onClose}
      isPending={addCopies.isPending}
    />
  );
}

interface AddEntryToCollectionDialogProps {
  request: AddEntryToCollectionRequest | null;
  onClose: () => void;
  listId?: string;
}

/** Confirms creating new owned copies from an organize list entry that tracks cards or printings. */
export function AddEntryToCollectionDialog({
  request,
  onClose,
  listId,
}: AddEntryToCollectionDialogProps) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        {request && (
          <Suspense fallback={null}>
            <ConnectedBody
              key={`${request.subject.printing.id}-${request.collectionId ?? ""}`}
              request={request}
              listId={listId}
              onClose={onClose}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
