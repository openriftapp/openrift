import { copyHasMetadata } from "@openrift/shared/copy-metadata";
import type { CopyResponse } from "@openrift/shared/types/api/collection";
import type { Printing } from "@openrift/shared/types/catalog";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { printingDisplayName } from "@/features/cards/lib/card-meta";
import type { CardRowClickModifiers } from "@/features/cards/stores/card-row-actions-store";
import { useBatchedAddCopies, useDisposeCopies } from "@/features/collections/hooks/use-copies";
import { useCopiesCollection } from "@/features/collections/hooks/use-copies-collection";
import {
  decideRemoval,
  pickRemovalCopy,
} from "@/features/collections/hooks/use-quick-add-actions-helpers";
import { summarizeBatchAdd } from "@/features/collections/lib/summarize-batch-add";
import { useAddModeStore } from "@/features/collections/stores/add-mode-store";
import type { VariantPopoverIntent } from "@/features/collections/stores/add-mode-store";
import { runReportedMutation } from "@/lib/run-reported-mutation";

/**
 * `sessionUndo` marks the session-undo path: add-mode bookkeeping runs only
 * when the dispose actually happens.
 */
export interface PendingAnnotatedDispose {
  copy: CopyResponse;
  printing: Printing;
  sessionUndo?: boolean;
}

/**
 * `viewCollectionId` scopes the minus button when set; undefined (All Cards)
 * looks across all collections and reports "ambiguous" on a multi-collection spread.
 */
export function useQuickAddActions(
  addTarget?: string,
  viewCollectionId?: string,
  onDisposed?: (printing: Printing) => void,
) {
  const pendingPrintingsRef = useRef<Map<string, Printing>>(new Map());
  const batchedAdd = useBatchedAddCopies({
    onBatchSuccess: (printingIds) => {
      const msg = summarizeBatchAdd(printingIds, (id) => {
        const printing = pendingPrintingsRef.current.get(id);
        return printing ? printingDisplayName(printing) : undefined;
      });
      if (msg) {
        toast.success(msg);
      }
      for (const id of new Set(printingIds)) {
        pendingPrintingsRef.current.delete(id);
      }
    },
    onBatchError: (printingIds) => {
      for (const id of new Set(printingIds)) {
        pendingPrintingsRef.current.delete(id);
      }
    },
  });
  const disposeCopies = useDisposeCopies();
  const copiesCollection = useCopiesCollection();

  // A minus press that would destroy recorded details parks here without disposing;
  // the consumer renders AnnotatedDisposeDialog against this state.
  const [pendingAnnotatedDispose, setPendingAnnotatedDispose] =
    useState<PendingAnnotatedDispose | null>(null);

  const confirmAnnotatedDispose = async () => {
    if (!pendingAnnotatedDispose) {
      return;
    }
    const { copy, printing, sessionUndo } = pendingAnnotatedDispose;
    setPendingAnnotatedDispose(null);
    if (sessionUndo) {
      useAddModeStore.getState().recordUndo(printing.printingId);
    }
    if (await runReportedMutation(() => disposeCopies.mutateAsync({ copyIds: [copy.id] }))) {
      if (onDisposed) {
        onDisposed(printing);
      }
      return;
    }
    if (sessionUndo) {
      useAddModeStore.getState().recordAdd(printing, copy.id);
    }
  };

  const cancelAnnotatedDispose = () => setPendingAnnotatedDispose(null);

  const addToCollection = async (printing: Printing, collectionId: string) => {
    pendingPrintingsRef.current.set(printing.printingId, printing);
    useAddModeStore.getState().incrementPending(printing);
    let real: Awaited<ReturnType<typeof batchedAdd.add>> | undefined;
    const added = await runReportedMutation(async () => {
      real = await batchedAdd.add(printing.printingId, collectionId);
    });
    if (added && real) {
      useAddModeStore.getState().recordAdd(printing, real.id);
    }
    useAddModeStore.getState().decrementPending(printing.printingId);
  };

  // Adds are issued individually; useBatchedAddCopies coalesces them into one request.
  const handleQuickAdd = addTarget
    ? async (printing: Printing, _modifiers?: CardRowClickModifiers, quantity = 1) => {
        await Promise.all(
          Array.from({ length: Math.max(1, quantity) }, () => addToCollection(printing, addTarget)),
        );
      }
    : undefined;

  const handleAddToCollection = (printing: Printing, collectionId: string) =>
    addToCollection(printing, collectionId);

  // Returns "ambiguous" when copies span multiple collections, so the caller
  // can escalate to the variant×collection popover.
  const tryUndoAdd = addTarget
    ? async (printing: Printing): Promise<"done" | "ambiguous"> => {
        const entry = useAddModeStore.getState().addedItems.get(printing.printingId);
        const sessionCopyId = entry?.copyIds.at(-1);
        if (sessionCopyId) {
          // Even a copy added this session may have been annotated since;
          // destroying those details still needs a confirmation.
          const sessionCopy = copiesCollection?.toArray.find((c) => c.id === sessionCopyId);
          if (sessionCopy && copyHasMetadata(sessionCopy)) {
            setPendingAnnotatedDispose({ copy: sessionCopy, printing, sessionUndo: true });
            return "done";
          }
          useAddModeStore.getState().recordUndo(printing.printingId);
          if (
            await runReportedMutation(() => disposeCopies.mutateAsync({ copyIds: [sessionCopyId] }))
          ) {
            if (onDisposed) {
              onDisposed(printing);
            }
          } else {
            useAddModeStore.getState().recordAdd(printing, sessionCopyId);
          }
          return "done";
        }
        if (!copiesCollection) {
          return "done";
        }
        const decision = decideRemoval(
          copiesCollection.toArray,
          printing.printingId,
          viewCollectionId,
        );
        if (decision.kind === "none") {
          return "done";
        }
        if (decision.kind === "confirmDispose") {
          const copy = copiesCollection.toArray.find((c) => c.id === decision.copyId);
          if (copy) {
            setPendingAnnotatedDispose({ copy, printing });
          }
          return "done";
        }
        if (decision.kind === "dispose") {
          const disposed = await runReportedMutation(() =>
            disposeCopies.mutateAsync({ copyIds: [decision.copyId] }),
          );
          if (disposed && onDisposed) {
            onDisposed(printing);
          }
          return "done";
        }
        return "ambiguous";
      }
    : undefined;

  const handleDisposeFromCollection = async (printing: Printing, fromCollectionId: string) => {
    if (!copiesCollection) {
      return;
    }
    const copies = copiesCollection.toArray.filter(
      (c) => c.printingId === printing.printingId && c.collectionId === fromCollectionId,
    );
    const candidate = pickRemovalCopy(copies);
    if (!candidate) {
      return;
    }
    if (copyHasMetadata(candidate)) {
      setPendingAnnotatedDispose({ copy: candidate, printing });
      return;
    }
    const disposed = await runReportedMutation(() =>
      disposeCopies.mutateAsync({ copyIds: [candidate.id] }),
    );
    if (disposed && onDisposed) {
      onDisposed(printing);
    }
  };

  const handleOpenVariants = addTarget
    ? (
        printing: Printing,
        anchorEl: HTMLElement,
        intent: VariantPopoverIntent,
        scopeToSet = false,
        scopeToPrinting = false,
      ) => {
        if (useAddModeStore.getState().closeVariantsOn(anchorEl)) {
          return;
        }
        useAddModeStore
          .getState()
          .openVariants(
            printing.cardId,
            anchorEl,
            intent,
            scopeToSet ? printing.setId : undefined,
            scopeToPrinting ? printing.printingId : undefined,
          );
      }
    : undefined;

  // A dismissal that starts on the popover's own anchor is left to that control's click,
  // which toggles the popover through the store's closeVariantsOn.
  const closeVariants = (pressTarget?: EventTarget | null) => {
    const anchor = useAddModeStore.getState().variantPopover?.anchorEl;
    if (anchor && pressTarget instanceof Node && anchor.contains(pressTarget)) {
      return;
    }
    useAddModeStore.getState().closeVariants();
  };

  return {
    handleQuickAdd,
    handleAddToCollection,
    tryUndoAdd,
    handleOpenVariants,
    handleDisposeFromCollection,
    closeVariants,
    pendingAnnotatedDispose,
    confirmAnnotatedDispose,
    cancelAnnotatedDispose,
    disposeIsPending: disposeCopies.isPending,
  };
}
