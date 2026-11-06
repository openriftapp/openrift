import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { InboxIcon, BookOpenIcon } from "lucide-react";
import { useState } from "react";

import { PickerDialog } from "@/components/picker-dialog";
import { QuantityStepperField } from "@/components/ui/quantity-stepper";
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
  const canChooseQuantity = singleCard && count > 1;
  const [quantity, setQuantity] = useState(count);
  const [seed, setSeed] = useState({ open, count });
  if (seed.open !== open || seed.count !== count) {
    setSeed({ open, count });
    if (open) {
      setQuantity(count);
    }
  }

  return (
    <PickerDialog
      alert
      open={open}
      onOpenChange={onOpenChange}
      title={m.collections_dialog_move_title()}
      before={
        canChooseQuantity ? (
          <QuantityStepperField
            label={m.collections_dialog_move_quantity_label()}
            value={quantity}
            onValueChange={setQuantity}
            max={count}
            disabled={isPending}
          />
        ) : null
      }
      options={collections.map((col) => ({
        value: col.id,
        label: col.name,
        keywords: [col.name],
        icon: col.isInbox ? (
          <InboxIcon className="size-4 shrink-0" />
        ) : (
          <BookOpenIcon className="size-4 shrink-0" />
        ),
      }))}
      searchPlaceholder={m.collections_dialog_move_filter_placeholder()}
      noMatchesText={m.collections_dialog_move_no_matches()}
      emptyText={m.collections_dialog_move_empty()}
      pending={isPending}
      {...(canChooseQuantity
        ? {
            confirm: {
              label: m.collections_dialog_move_confirm(),
              pendingLabel: m.collections_dialog_move_pending(),
              onConfirm: (collectionId: string) => onMove(collectionId, quantity),
            },
          }
        : { onPick: (collectionId: string) => onMove(collectionId, count) })}
    />
  );
}
