import type { Printing } from "@openrift/shared/types/catalog";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AnnotatedDisposeDialog } from "@/features/collections/components/annotated-dispose-dialog";
import { VariantLocationsPopoverHost } from "@/features/collections/components/variant-locations-popover-host";
import { useQuickAddActions } from "@/features/collections/hooks/use-quick-add-actions";
import { collectionsQueryOptions } from "@/features/collections/lib/collections-query";
import { useWishEntries } from "@/features/groups/hooks/use-wish-entries";
import { WishlistPickerHost } from "@/features/lists/components/wishlist-picker-host";
import { useUserId } from "@/lib/auth-session";

/**
 * Add and remove wiring for a surface that never registers card-row handlers,
 * so the row dispatchers would no-op there. Owns the dialogs those actions open;
 * mount `hosts` once, outside whatever renders the buttons.
 */
export function useCardDetailActionHost({
  printingsByCardId,
  enabled = true,
}: {
  printingsByCardId: ReadonlyMap<string, Printing[]>;
  enabled?: boolean;
}) {
  const userId = useUserId();
  const active = enabled && userId !== null;
  const { data: collections } = useQuery({
    ...collectionsQueryOptions(userId ?? ""),
    enabled: active,
  });
  const inbox = collections?.find((collection) => collection.isInbox);
  const {
    handleQuickAdd,
    handleAddToCollection,
    tryUndoAdd,
    handleOpenVariants,
    handleDisposeFromCollection,
    closeVariants,
    pendingAnnotatedDispose,
    confirmAnnotatedDispose,
    cancelAnnotatedDispose,
    disposeIsPending,
  } = useQuickAddActions(inbox?.id);

  const wish = useWishEntries(active);
  const [wishTarget, setWishTarget] = useState<Printing | null>(null);

  const addCopy = (printing: Printing) => {
    if (handleQuickAdd) {
      void handleQuickAdd(printing);
    }
  };

  const removeCopy = (printing: Printing, anchorEl: HTMLElement) => {
    void (async () => {
      const result = await tryUndoAdd?.(printing);
      if (result === "ambiguous" && handleOpenVariants) {
        handleOpenVariants(printing, anchorEl, "remove", false, true);
      }
    })();
  };

  const hosts = (
    <>
      <VariantLocationsPopoverHost
        catalogPrintingsByCardId={printingsByCardId}
        languageScopedPrintingsByCardId={printingsByCardId}
        onQuickAdd={handleQuickAdd ? (target) => void handleQuickAdd(target) : undefined}
        defaultTargetCollectionId={inbox?.id}
        onAddToCollection={(target, collectionId) =>
          void handleAddToCollection(target, collectionId)
        }
        onRemoveFromCollection={(target, collectionId) =>
          void handleDisposeFromCollection(target, collectionId)
        }
        closeVariants={closeVariants}
      />
      <WishlistPickerHost target={wishTarget} onClose={() => setWishTarget(null)} />
      <AnnotatedDisposeDialog
        pending={pendingAnnotatedDispose}
        onConfirm={() => void confirmAnnotatedDispose()}
        onCancel={cancelAnnotatedDispose}
        isPending={disposeIsPending}
      />
    </>
  );

  return {
    inbox,
    canAdd: handleQuickAdd !== undefined,
    addCopy,
    removeCopy,
    wish,
    setWishTarget,
    hosts,
  };
}
