import type { CopyResponse } from "@openrift/shared/types/api/collection";
import type { ListIntent } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { CheckIcon } from "lucide-react";
import { Suspense, useState } from "react";

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
import { ImportPrintingLabel } from "@/features/cards/components/printing-label";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCollectionsMap } from "@/features/collections/hooks/use-collections";
import { useCopyRowsForPrintings } from "@/features/collections/hooks/use-owned-count";
import type {
  MoveEntrySubject,
  MoveEntryTarget,
  MoveMode,
  MovePick,
  MoveResolution,
} from "@/features/lists/lib/list-move";
import { movePickFor } from "@/features/lists/lib/list-move";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function intentNoun(intent: ListIntent): string {
  switch (intent) {
    case "wish": {
      return m.lists_move_intent_wish();
    }
    case "trade": {
      return m.lists_move_intent_trade();
    }
    case "organize": {
      return m.lists_move_intent_organize();
    }
  }
}

function modeCopy(mode: MoveMode) {
  return mode === "copy"
    ? {
        title: m.lists_copy_dialog_title,
        sameIntent: m.lists_copy_same_intent_note,
        crossIntent: m.lists_copy_intent_note,
        confirm: m.lists_copy_confirm,
        pending: m.lists_copy_pending,
      }
    : {
        title: m.lists_move_dialog_title,
        sameIntent: m.lists_move_same_intent_note,
        crossIntent: m.lists_move_intent_note,
        confirm: m.lists_move_confirm,
        pending: m.lists_move_pending,
      };
}

export interface MoveEntryCopyOption {
  copy: CopyResponse;
  printing: Printing;
  collectionName: string;
}

interface MoveEntryDialogBodyProps {
  mode: MoveMode;
  cardName: string;
  sourceIntent: ListIntent;
  target: { name: string; intent: ListIntent };
  pick: MovePick;
  currentPrintingId: string;
  printings: Printing[];
  copies: MoveEntryCopyOption[];
  quantity: number;
  onConfirm: (resolution: MoveResolution | null) => void;
  onCancel: () => void;
  isPending: boolean;
}

const SELECTED_ROW =
  "bg-primary/10 text-primary data-selected:bg-primary/10 data-selected:text-primary data-selected:**:text-primary";

export function MoveEntryDialogBody({
  mode,
  cardName,
  sourceIntent,
  target,
  pick,
  currentPrintingId,
  printings,
  copies,
  quantity,
  onConfirm,
  onCancel,
  isPending,
}: MoveEntryDialogBodyProps) {
  const text = modeCopy(mode);
  const [highlightedId, setHighlightedId] = useState("");
  const [printingId, setPrintingId] = useState(
    () => printings.find((p) => p.id === currentPrintingId)?.id ?? printings.at(0)?.id ?? null,
  );
  const [copyIds, setCopyIds] = useState(
    () => new Set(copies.slice(0, quantity).map((option) => option.copy.id)),
  );

  const toggleCopy = (copyId: string) => {
    setCopyIds((prev) => {
      const next = new Set(prev);
      if (next.has(copyId)) {
        next.delete(copyId);
      } else {
        next.add(copyId);
      }
      return next;
    });
  };

  const canConfirm =
    !isPending &&
    (pick === "none" ||
      (pick === "printing" && printingId !== null) ||
      (pick === "copies" && copyIds.size > 0));

  const submit = () => {
    if (!canConfirm) {
      return;
    }
    if (pick === "printing") {
      onConfirm({ printingId: printingId ?? undefined });
      return;
    }
    if (pick === "copies") {
      onConfirm({ copyIds: [...copyIds] });
      return;
    }
    onConfirm(null);
  };

  return (
    <DialogForm onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{text.title({ list: target.name })}</DialogTitle>
        <DialogDescription>
          {sourceIntent === target.intent
            ? text.sameIntent({ card: cardName })
            : text.crossIntent({
                card: cardName,
                source: intentNoun(sourceIntent),
                target: intentNoun(target.intent),
              })}
        </DialogDescription>
      </DialogHeader>
      {pick === "printing" && (
        <div className="space-y-2">
          <p className="text-sm">{m.lists_move_pick_printing_hint({ list: target.name })}</p>
          <PickerList highlightedId={highlightedId} onHighlightChange={setHighlightedId}>
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
      {pick === "copies" &&
        (copies.length === 0 ? (
          <Empty>
            <EmptyDescription>{m.lists_move_no_copies({ card: cardName })}</EmptyDescription>
          </Empty>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">{m.lists_move_pick_copies_hint({ list: target.name })}</p>
            <PickerList highlightedId={highlightedId} onHighlightChange={setHighlightedId}>
              {copies.map(({ copy, printing, collectionName }) => {
                const checked = copyIds.has(copy.id);
                return (
                  <PickerRow
                    key={copy.id}
                    value={copy.id}
                    onSelect={() => toggleCopy(copy.id)}
                    className={cn("px-3 py-2", checked && SELECTED_ROW)}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "border-input flex size-4 shrink-0 items-center justify-center rounded-md border",
                        checked && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {checked && <CheckIcon className="size-3" />}
                    </span>
                    <ImportPrintingLabel printing={printing} className="min-w-0 flex-1 truncate" />
                    <span className="text-muted-foreground truncate text-sm">{collectionName}</span>
                  </PickerRow>
                );
              })}
            </PickerList>
          </div>
        ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          {m.common_cancel()}
        </Button>
        <Button type="submit" disabled={!canConfirm}>
          {isPending ? text.pending() : text.confirm()}
        </Button>
      </div>
    </DialogForm>
  );
}

interface ConnectedBodyProps {
  mode: MoveMode;
  subject: MoveEntrySubject;
  target: MoveEntryTarget;
  onConfirm: (resolution: MoveResolution | null) => void;
  onCancel: () => void;
  isPending: boolean;
}

/** Loads the printings and owned copies a pick needs; mount inside a Suspense boundary. */
export function ConnectedMoveEntryDialogBody({
  mode,
  subject,
  target,
  onConfirm,
  onCancel,
  isPending,
}: ConnectedBodyProps) {
  const pick = movePickFor(subject.sourceKind, target.listKind);
  const { printingsByCardId } = useCards();
  const collectionsById = useCollectionsMap();
  const cardPrintings = printingsByCardId.get(subject.printing.cardId) ?? [subject.printing];
  const candidatePrintings = subject.sourceKind === "printing" ? [subject.printing] : cardPrintings;
  const { data: copyRows } = useCopyRowsForPrintings(
    candidatePrintings.map((p) => p.id),
    pick === "copies",
  );
  const printingById = new Map(candidatePrintings.map((p) => [p.id, p]));
  const copies: MoveEntryCopyOption[] = (copyRows ?? []).flatMap((copy) => {
    const printing = printingById.get(copy.printingId);
    if (!printing) {
      return [];
    }
    return [{ copy, printing, collectionName: collectionsById.get(copy.collectionId)?.name ?? "" }];
  });

  return (
    <MoveEntryDialogBody
      mode={mode}
      cardName={subject.cardName}
      sourceIntent={subject.sourceIntent}
      target={{ name: target.listName, intent: target.listIntent }}
      pick={pick}
      currentPrintingId={subject.printing.id}
      printings={cardPrintings}
      copies={copies}
      quantity={subject.totalQuantity}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isPending={isPending}
    />
  );
}

export interface PendingEntryMove {
  mode: MoveMode;
  subject: MoveEntrySubject;
  target: MoveEntryTarget & { listId: string };
}

interface MoveEntryDialogProps {
  pending: PendingEntryMove | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (resolution: MoveResolution | null) => void;
  isPending: boolean;
}

/** Confirms a dropped list-entry move that changes intent or needs a printing/copy pick. */
export function MoveEntryDialog({
  pending,
  onOpenChange,
  onConfirm,
  isPending,
}: MoveEntryDialogProps) {
  return (
    <Dialog open={pending !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {pending && (
          <Suspense fallback={null}>
            <ConnectedMoveEntryDialogBody
              key={`${pending.subject.entryIds.join(",")}-${pending.target.listId}`}
              mode={pending.mode}
              subject={pending.subject}
              target={pending.target}
              onConfirm={onConfirm}
              onCancel={() => onOpenChange(false)}
              isPending={isPending}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
