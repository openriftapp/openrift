import type { CollectionResponse } from "@openrift/shared/types/api/collection";

import { printingDisplayName } from "@/features/cards/lib/card-meta";
import { DisposeDialog } from "@/features/collections/components/dispose-dialog";
import { MoveDialog } from "@/features/collections/components/move-dialog";
import type { CollectionGridActions } from "@/features/collections/hooks/use-collection-grid-actions";
import { LendCardDialog } from "@/features/groups/components/lend-card-dialog";
import { AddToListDialog } from "@/features/lists/components/add-to-list-dialog";

interface CollectionGridActionDialogsProps {
  actions: CollectionGridActions;
  collections: CollectionResponse[];
  collectionId: string | undefined;
  sourceCollectionIsGroup: boolean;
  onAdded: () => void;
}

export function CollectionGridActionDialogs({
  actions,
  collections,
  collectionId,
  sourceCollectionIsGroup,
  onAdded,
}: CollectionGridActionDialogsProps) {
  const lendTarget = actions.lendTarget;
  const handleMoveOpenChange = actions.setMoveOpen;
  const handleDisposeOpenChange = actions.setDisposeOpen;
  const handleDisposeQuantityChange = actions.setDisposeQuantity;
  const handleAddToListOpenChange = actions.setAddToListOpen;

  return (
    <>
      <MoveDialog
        open={actions.moveOpen}
        onOpenChange={handleMoveOpenChange}
        collections={collections.filter((collection) => collection.id !== collectionId)}
        count={actions.actionCopyIds.length}
        singleCard={actions.actionSingleCard}
        onMove={actions.handleMove}
        isPending={actions.moveIsPending}
      />

      <DisposeDialog
        open={actions.disposeOpen}
        onOpenChange={handleDisposeOpenChange}
        count={actions.actionCopyIds.length}
        quantity={actions.disposeQuantity}
        onQuantityChange={handleDisposeQuantityChange}
        singleCard={actions.actionSingleCard}
        onConfirm={actions.handleDispose}
        isPending={actions.disposeIsPending}
        memberships={actions.disposeListMemberships.data}
        membershipsLoading={actions.disposeListMemberships.isLoading}
        annotatedCount={actions.disposeAnnotatedCount}
      />

      {actions.addToListOpen && (
        <AddToListDialog
          open={actions.addToListOpen}
          onOpenChange={handleAddToListOpenChange}
          copyIds={actions.actionCopyIds}
          groupOwnedOnly={sourceCollectionIsGroup}
          singleCard={actions.actionSingleCard}
          onAdded={onAdded}
        />
      )}

      {lendTarget ? (
        <LendCardDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              actions.setLendTarget(null);
            }
          }}
          printing={lendTarget.printing}
          cardName={printingDisplayName(lendTarget.printing)}
          maxQuantity={lendTarget.maxQuantity}
          contextCollectionId={collectionId}
        />
      ) : null}
    </>
  );
}
