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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportPrintingLabel } from "@/features/cards/components/printing-label";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCollections } from "@/features/collections/hooks/use-collections";
import { useAddCopies } from "@/features/collections/hooks/use-copies";
import type {
  AddEntryToCollectionRequest,
  AddEntryToCollectionSubject,
} from "@/features/lists/lib/list-move";
import { listsKeys } from "@/features/lists/lib/lists-query-keys";
import { useEnumOrders } from "@/hooks/use-enums";
import { useUserId } from "@/lib/auth-session";
import { formatImportPrintingLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const SELECTED_ROW =
  "bg-primary/10 text-primary data-selected:bg-primary/10 data-selected:text-primary data-selected:**:text-primary";

function CollectionPicker({
  collections,
  collectionId,
  onSelect,
}: {
  collections: CollectionResponse[];
  collectionId: string | null;
  onSelect: (collectionId: string) => void;
}) {
  const [highlighted, setHighlighted] = useState("");
  if (collections.length === 0) {
    return (
      <Empty>
        <EmptyDescription>{m.collections_dialog_move_empty()}</EmptyDescription>
      </Empty>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm">{m.lists_add_to_collection_pick_collection()}</p>
      <PickerList highlightedId={highlighted} onHighlightChange={setHighlighted}>
        {collections.map((collection) => (
          <PickerRow
            key={collection.id}
            value={collection.id}
            keywords={[collection.name]}
            onSelect={() => onSelect(collection.id)}
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
  );
}

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
      {!fixedCollection && (
        <CollectionPicker
          collections={collections}
          collectionId={collectionId}
          onSelect={setCollectionId}
        />
      )}
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

interface AddCopiesPick {
  printingId: string;
  quantity: number;
}

interface AddEntriesToCollectionDialogBodyProps {
  subjects: AddEntryToCollectionSubject[];
  fixedCollection?: CollectionResponse;
  collections: CollectionResponse[];
  /** Every printing of each card, for the per-row picker on a card-kind list. */
  printingsByCardId: ReadonlyMap<string, Printing[]>;
  printingLabel: (printing: Printing) => string;
  onConfirm: (input: { collectionId: string; picks: AddCopiesPick[] }) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function AddEntriesToCollectionDialogBody({
  subjects,
  fixedCollection,
  collections,
  printingsByCardId,
  printingLabel,
  onConfirm,
  onCancel,
  isPending,
}: AddEntriesToCollectionDialogBodyProps) {
  const [collectionId, setCollectionId] = useState(
    () =>
      fixedCollection?.id ??
      collections.find((collection) => collection.isInbox)?.id ??
      collections.at(0)?.id ??
      null,
  );
  const [printingIds, setPrintingIds] = useState(() =>
    subjects.map((subject) => subject.printing.id),
  );

  const canPickPrinting = subjects[0]?.sourceKind === "card";
  const total = subjects.reduce((sum, subject) => sum + Math.max(subject.totalQuantity, 1), 0);
  const overLimit = total > MAX_COPIES_PER_ADD;
  const canConfirm = !isPending && collectionId !== null && !overLimit && subjects.length > 0;
  const submit = () => {
    if (canConfirm && collectionId !== null) {
      onConfirm({
        collectionId,
        picks: subjects.map((subject, index) => ({
          printingId: printingIds[index] ?? subject.printing.id,
          quantity: Math.max(subject.totalQuantity, 1),
        })),
      });
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
          {m.lists_add_to_collection_note_multi({ count: subjects.length })}
        </DialogDescription>
      </DialogHeader>
      {canPickPrinting && <p className="text-sm">{m.lists_add_to_collection_pick_printings()}</p>}
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {subjects.map((subject, index) => {
          const printings = printingsByCardId.get(subject.printing.cardId) ?? [subject.printing];
          const items = printings.map((printing) => ({
            value: printing.id,
            label: printingLabel(printing),
          }));
          return (
            <div
              key={`${subject.printing.id}-${index}`}
              className="flex items-center gap-2 px-1 py-0.5"
            >
              <span className="text-muted-foreground w-8 shrink-0 text-right font-mono text-sm">
                {subject.totalQuantity}&times;
              </span>
              <span className="min-w-0 flex-1 truncate">{subject.cardName}</span>
              {canPickPrinting && printings.length > 1 ? (
                <Select
                  items={items}
                  value={printingIds[index] ?? subject.printing.id}
                  onValueChange={(next) =>
                    setPrintingIds((current) =>
                      current.map((id, at) => (at === index ? String(next) : id)),
                    )
                  }
                >
                  <SelectTrigger
                    className="h-7 w-44"
                    aria-label={m.lists_add_to_collection_printing_aria({
                      card: subject.cardName,
                    })}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <ImportPrintingLabel
                  printing={printings.find((p) => p.id === printingIds[index]) ?? subject.printing}
                  className="max-w-44 min-w-0 shrink-0 truncate"
                />
              )}
            </div>
          );
        })}
      </div>
      {!fixedCollection && (
        <CollectionPicker
          collections={collections}
          collectionId={collectionId}
          onSelect={setCollectionId}
        />
      )}
      {overLimit && (
        <p className="text-destructive text-sm">
          {m.lists_add_to_collection_too_many({ max: MAX_COPIES_PER_ADD })}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          {m.common_cancel()}
        </Button>
        <Button type="submit" disabled={!canConfirm}>
          {isPending
            ? m.lists_add_to_collection_pending()
            : m.lists_add_to_collection_confirm_multi({ count: total })}
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
  const { labels } = useEnumOrders();
  const addCopies = useAddCopies();
  const [subject] = request.subjects;
  const fixedCollection =
    request.collectionId === undefined
      ? undefined
      : collections.find((collection) => collection.id === request.collectionId);

  const addPicks = (collectionId: string, picks: AddCopiesPick[]) => {
    const collectionName = collections.find((collection) => collection.id === collectionId)?.name;
    const copies = picks.flatMap((pick) =>
      Array.from({ length: pick.quantity }, () => ({ printingId: pick.printingId, collectionId })),
    );
    addCopies.mutate(
      { copies },
      {
        onSuccess: () => {
          toast.success(
            m.lists_toast_added_to_collection({
              count: copies.length,
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

  if (request.subjects.length !== 1 || !subject) {
    return (
      <AddEntriesToCollectionDialogBody
        subjects={request.subjects}
        fixedCollection={fixedCollection}
        collections={collections}
        printingsByCardId={printingsByCardId}
        printingLabel={(printing) => formatImportPrintingLabel(printing, labels)}
        onConfirm={({ collectionId, picks }) => addPicks(collectionId, picks)}
        onCancel={onClose}
        isPending={addCopies.isPending}
      />
    );
  }

  const printings =
    subject.sourceKind === "card"
      ? (printingsByCardId.get(subject.printing.cardId) ?? [subject.printing])
      : [subject.printing];

  return (
    <AddEntryToCollectionDialogBody
      subject={subject}
      fixedCollection={fixedCollection}
      collections={collections}
      printings={printings}
      onConfirm={({ printingId, collectionId, quantity }) =>
        addPicks(collectionId, [{ printingId, quantity }])
      }
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
              key={`${request.subjects.map((subject) => subject.printing.id).join(",")}-${request.collectionId ?? ""}`}
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
