import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import {
  CollectionRadioPicker,
  NEW_COLLECTION_OPTION,
} from "@/features/collections/components/collection-radio-picker";
import { useCollections, useCreateCollection } from "@/features/collections/hooks/use-collections";
import { useTradeAddTargetStore } from "@/features/groups/stores/trade-add-target-store";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

// Changes where incoming trade copies land, and nothing else: the settle
// session commits every row at once, so the target must be set beforehand.
export function TradeAddTargetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <Suspense
            fallback={
              <div className="text-muted-foreground py-4 text-sm">
                {m.trades_loading_collections()}
              </div>
            }
          >
            <TradeAddTargetBody onClose={() => onOpenChange(false)} />
          </Suspense>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TradeAddTargetBody({ onClose }: { onClose: () => void }) {
  const { data: collections } = useCollections();
  const createCollection = useCreateCollection();
  const setTarget = useTradeAddTargetStore((state) => state.setTarget);

  // A remembered collection that has since been deleted falls back to the inbox.
  const remembered = useTradeAddTargetStore((state) => state.target);
  const inbox = collections.find((collection) => collection.isInbox);
  const rememberedId = collections.find((collection) => collection.id === remembered?.id)?.id;
  const [selectedId, setSelectedId] = useState<string>(
    () => rememberedId ?? inbox?.id ?? collections[0]?.id ?? NEW_COLLECTION_OPTION,
  );
  const [newName, setNewName] = useState<string>(m.trades_default_collection_name());

  const confirm = async () => {
    const newCollectionName = newName.trim() || m.trades_default_collection_name();
    const pickedName =
      collections.find((collection) => collection.id === selectedId)?.name ?? newCollectionName;
    const resolveTargetId = async () => {
      if (selectedId !== NEW_COLLECTION_OPTION) {
        return selectedId;
      }
      const created = await createCollection.mutateAsync({ name: newCollectionName });
      return created.id;
    };
    let targetId: string | undefined;
    const ok = await runReportedMutation(async () => {
      targetId = await resolveTargetId();
    });
    if (ok && targetId !== undefined) {
      setTarget({ id: targetId, name: pickedName });
      onClose();
    }
  };

  return (
    <DialogForm onSubmit={() => void confirm()}>
      <DialogHeader>
        <DialogTitle>{m.trades_target_title()}</DialogTitle>
        <DialogDescription>{m.trades_target_description()}</DialogDescription>
      </DialogHeader>

      <CollectionRadioPicker
        collections={collections}
        selectedId={selectedId}
        onSelectedIdChange={setSelectedId}
        newName={newName}
        onNewNameChange={setNewName}
        idPrefix="trade-add-target"
      />

      <DialogFooter>
        <DialogCancel />
        <Button
          type="submit"
          disabled={
            createCollection.isPending ||
            (selectedId === NEW_COLLECTION_OPTION && newName.trim().length === 0)
          }
        >
          {m.trades_use_this_collection()}
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}
