import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { m } from "@/paraglide/messages.js";

interface ListRemoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
  isPending: boolean;
}

export function ListRemoveDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  isPending,
}: ListRemoveDialogProps) {
  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.lists_remove_title()}
      description={m.lists_remove_description({ count })}
      confirmLabel={m.lists_remove_confirm({ count })}
      pendingLabel={m.lists_remove_pending()}
      onConfirm={onConfirm}
      isPending={isPending}
    />
  );
}
