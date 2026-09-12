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
      description={
        count === 1
          ? m.lists_remove_description_one({ count })
          : m.lists_remove_description_other({ count })
      }
      confirmLabel={
        count === 1
          ? m.lists_remove_confirm_one({ count })
          : m.lists_remove_confirm_other({ count })
      }
      pendingLabel={m.lists_remove_pending()}
      onConfirm={onConfirm}
      isPending={isPending}
    />
  );
}
