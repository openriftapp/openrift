import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { InboxIcon, BookOpenIcon } from "lucide-react";
import { useState } from "react";

import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CommandEmpty } from "@/components/ui/command";
import { DialogForm } from "@/components/ui/dialog-form";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { PickerList, PickerRow } from "@/components/ui/picker-list";
import { QuantityStepperField } from "@/components/ui/quantity-stepper";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: CollectionResponse[];
  count: number;
  singleCard?: boolean;
  onMove: (toCollectionId: string, quantity: number) => void;
  isPending: boolean;
}

export function MoveDialog({
  open,
  onOpenChange,
  collections,
  count,
  singleCard = false,
  onMove,
  isPending,
}: MoveDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState("");

  // Re-arm on every open: an old pick could leave an unrelated row lit up and
  // one Enter away from moving the cards somewhere nobody chose.
  const canChooseQuantity = singleCard && count > 1;
  const [quantity, setQuantity] = useState(count);
  const [seed, setSeed] = useState({ open, count });
  if (seed.open !== open || seed.count !== count) {
    setSeed({ open, count });
    if (open) {
      setQuantity(count);
      setSelectedId(null);
      setHighlightedId("");
    }
  }
  const effectiveQuantity = canChooseQuantity ? quantity : count;

  const pick = (collectionId: string) => {
    if (isPending) {
      return;
    }
    if (canChooseQuantity) {
      setSelectedId(collectionId);
      return;
    }
    onMove(collectionId, count);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <DialogForm onSubmit={() => selectedId && onMove(selectedId, effectiveQuantity)}>
          <AlertDialogTitle>{m.collections_dialog_move_title()}</AlertDialogTitle>
          {canChooseQuantity && (
            <QuantityStepperField
              label={m.collections_dialog_move_quantity_label()}
              value={quantity}
              onValueChange={setQuantity}
              max={count}
              disabled={isPending}
            />
          )}
          {/* No overflow here — CommandList scrolls internally, keeping the filter input pinned. */}
          <div>
            {collections.length === 0 ? (
              <Empty>
                <EmptyDescription>{m.collections_dialog_move_empty()}</EmptyDescription>
              </Empty>
            ) : (
              <PickerList
                searchPlaceholder={m.collections_dialog_move_filter_placeholder()}
                highlightedId={highlightedId}
                onHighlightChange={setHighlightedId}
              >
                <CommandEmpty>{m.collections_dialog_move_no_matches()}</CommandEmpty>
                {collections.map((col) => (
                  <PickerRow
                    key={col.id}
                    value={col.id}
                    keywords={[col.name]}
                    onSelect={() => pick(col.id)}
                    className={cn(
                      "px-3 py-2",
                      selectedId === col.id &&
                        "bg-primary/10 text-primary data-selected:bg-primary/10 data-selected:text-primary data-selected:**:text-primary",
                    )}
                  >
                    {col.isInbox ? (
                      <InboxIcon className="size-4 shrink-0" />
                    ) : (
                      <BookOpenIcon className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{col.name}</span>
                  </PickerRow>
                ))}
              </PickerList>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              {m.common_cancel()}
            </Button>
            {canChooseQuantity && (
              <Button type="submit" disabled={!selectedId || isPending}>
                {isPending
                  ? m.collections_dialog_move_pending()
                  : m.collections_dialog_move_confirm()}
              </Button>
            )}
          </div>
        </DialogForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
