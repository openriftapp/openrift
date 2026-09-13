import type { Printing } from "@openrift/shared/types/catalog";
import { useState } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogForm } from "@/components/ui/dialog-form";
import type { WishEntryFlat } from "@/features/groups/lib/wish-entry";
import { useRemoveListEntry, useUpdateListEntry } from "@/features/lists/hooks/use-lists";
import { m } from "@/paraglide/messages.js";

interface TakeWishlistFollowUpDialogProps {
  printing: Printing | null;
  entries: WishEntryFlat[];
  takenQuantity: number;
  onOpenChange: (open: boolean) => void;
}

export function TakeWishlistFollowUpDialog({
  printing,
  entries,
  takenQuantity,
  onOpenChange,
}: TakeWishlistFollowUpDialogProps) {
  const open = printing !== null;
  const removeEntry = useRemoveListEntry();
  const updateEntry = useUpdateListEntry();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(entries.map((entry) => entry.entryId)),
  );

  const [armedFor, setArmedFor] = useState(entries);
  if (armedFor !== entries) {
    setArmedFor(entries);
    setSelectedIds(new Set(entries.map((entry) => entry.entryId)));
  }

  const isPending = removeEntry.isPending || updateEntry.isPending;
  const single = entries.length === 1;

  const applyRemoval = async () => {
    const chosen = entries.filter((entry) => selectedIds.has(entry.entryId));
    const updates = chosen.map((entry) => {
      const decrement = Math.min(entry.quantity, takenQuantity);
      return entry.quantity - decrement <= 0
        ? removeEntry.mutateAsync({ listId: entry.listId, entryId: entry.entryId })
        : updateEntry.mutateAsync({
            listId: entry.listId,
            entryId: entry.entryId,
            quantity: entry.quantity - decrement,
          });
    });
    const message = m.collections_dialog_take_wishlist_updated({ count: chosen.length });
    try {
      await Promise.all(updates);
      toast.success(message);
      onOpenChange(false);
    } catch {
      /* Reported by the global mutation error toast. */
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <DialogForm onSubmit={() => void applyRemoval()}>
          <AlertDialogTitle>{m.collections_dialog_take_wishlist_title()}</AlertDialogTitle>
          {!single && (
            <div className="flex flex-col gap-2 py-1">
              {entries.map((entry) => (
                <label key={entry.entryId} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.has(entry.entryId)}
                    onCheckedChange={(checked) =>
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) {
                          next.add(entry.entryId);
                        } else {
                          next.delete(entry.entryId);
                        }
                        return next;
                      })
                    }
                  />
                  <span className="truncate">{entry.listName}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              {single
                ? m.collections_dialog_take_wishlist_keep()
                : m.collections_dialog_take_wishlist_keep_all()}
            </Button>
            <Button type="submit" disabled={isPending || selectedIds.size === 0}>
              {single
                ? m.collections_dialog_take_wishlist_remove_from({
                    list: entries[0]?.listName ?? "",
                  })
                : m.collections_dialog_take_wishlist_remove_selected()}
            </Button>
          </div>
        </DialogForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
