import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { m } from "@/paraglide/messages.js";

interface DeleteCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionName: string;
  copyCount: number;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteCollectionDialog({
  open,
  onOpenChange,
  collectionName,
  copyCount,
  onConfirm,
  isPending,
}: DeleteCollectionDialogProps) {
  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.collections_dialog_delete_title()}
      description={
        <>
          {m.collections_dialog_delete_confirm({ name: collectionName })}{" "}
          {copyCount === 0
            ? m.collections_dialog_delete_empty()
            : m.collections_dialog_delete_moved({ count: copyCount })}
        </>
      }
      confirmLabel={m.common_delete()}
      pendingLabel={m.collections_dialog_delete_pending()}
      onConfirm={onConfirm}
      isPending={isPending}
    />
  );
}
