import { useQueryClient } from "@tanstack/react-query";
import { BookOpenIcon, InboxIcon } from "lucide-react";
import { toast } from "sonner";

import { PickerDialog } from "@/components/picker-dialog";
import type { PickerOption } from "@/components/picker-dialog";
import { useCollections } from "@/features/collections/hooks/use-collections";
import { useCopies, useMoveCopies } from "@/features/collections/hooks/use-copies";
import {
  alreadyInCollectionCounts,
  copyIdsToMove,
} from "@/features/collections/lib/copy-move-plan";
import { listsKeys } from "@/features/lists/lib/lists-query-keys";
import { useUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";

interface MoveCopiesToCollectionDialogProps {
  listId: string;
  copyIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved?: () => void;
}

/**
 * The list is left alone; membership follows the copy. The list detail query
 * is invalidated because a dynamic rule scoped to source collections stops
 * matching once the copies land elsewhere.
 */
export function MoveCopiesToCollectionDialog({
  listId,
  copyIds,
  open,
  onOpenChange,
  onMoved,
}: MoveCopiesToCollectionDialogProps) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { data: collections } = useCollections();
  const { data: copies, isReady } = useCopies();
  const moveCopies = useMoveCopies();

  const collectionIdByCopyId = new Map(copies.map((copy) => [copy.id, copy.collectionId]));
  const total = new Set(copyIds).size;
  const alreadyHere = alreadyInCollectionCounts(copyIds, collectionIdByCopyId);
  const toMoveInto = (collectionId: string) =>
    copyIdsToMove(copyIds, collectionIdByCopyId, collectionId);

  const handleMove = (toCollectionId: string) => {
    const toMove = toMoveInto(toCollectionId);
    if (toMove.length === 0) {
      return;
    }
    const already = total - toMove.length;
    const collectionName = collections.find((col) => col.id === toCollectionId)?.name ?? "";
    moveCopies.mutate(
      { copyIds: toMove, toCollectionId },
      {
        onSuccess: () => {
          toast.success(
            m.lists_toast_moved_to_collection({ count: toMove.length, collection: collectionName }),
            already > 0
              ? { description: m.lists_toast_already_in_collection({ count: already }) }
              : undefined,
          );
          onOpenChange(false);
          onMoved?.();
          if (userId) {
            void queryClient.invalidateQueries({
              queryKey: listsKeys.detail(userId, listId),
            });
            void queryClient.invalidateQueries({ queryKey: listsKeys.all(userId) });
          }
        },
      },
    );
  };

  const options: PickerOption[] = collections.map((col) => {
    const here = alreadyHere.get(col.id) ?? 0;
    return {
      value: col.id,
      label: col.name,
      keywords: [col.name],
      icon: col.isInbox ? (
        <InboxIcon className="size-4 shrink-0" />
      ) : (
        <BookOpenIcon className="size-4 shrink-0" />
      ),
      meta: here > 0 ? m.lists_move_to_collection_already_here({ count: here }) : undefined,
      disabled: total === 1 && (!isReady || here > 0),
    };
  });

  return (
    <PickerDialog
      alert
      open={open}
      onOpenChange={onOpenChange}
      title={m.lists_move_to_collection_title({ count: total })}
      options={options}
      searchPlaceholder={m.collections_dialog_move_filter_placeholder()}
      noMatchesText={m.collections_dialog_move_no_matches()}
      emptyText={m.collections_dialog_move_empty()}
      pending={moveCopies.isPending}
      {...(total > 1
        ? {
            confirm: {
              label: (selected: string | null) => {
                if (selected === null) {
                  return m.lists_move_to_collection_confirm({ count: total });
                }
                const count = toMoveInto(selected).length;
                return count === 0
                  ? m.lists_move_to_collection_none()
                  : m.lists_move_to_collection_confirm({ count });
              },
              pendingLabel: m.collections_dialog_move_pending(),
              disabledFor: (selected: string) => !isReady || toMoveInto(selected).length === 0,
              onConfirm: handleMove,
            },
          }
        : { onPick: handleMove })}
    />
  );
}
