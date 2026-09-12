import type { ListKind } from "@openrift/shared/types/api/list";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { m } from "@/paraglide/messages.js";

interface DeleteListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listName: string;
  kind: ListKind;
  entryCount: number;
  onConfirm: () => void;
  isPending: boolean;
}

function deleteTail(kind: ListKind, entryCount: number): string {
  if (entryCount === 0) {
    return m.lists_delete_tail_empty();
  }
  if (kind === "copy") {
    return entryCount === 1
      ? m.lists_delete_tail_copy_one({ count: entryCount })
      : m.lists_delete_tail_copy_other({ count: entryCount });
  }
  if (kind === "printing") {
    return entryCount === 1
      ? m.lists_delete_tail_printing_one({ count: entryCount })
      : m.lists_delete_tail_printing_other({ count: entryCount });
  }
  return entryCount === 1
    ? m.lists_delete_tail_card_one({ count: entryCount })
    : m.lists_delete_tail_card_other({ count: entryCount });
}

export function DeleteListDialog({
  open,
  onOpenChange,
  listName,
  kind,
  entryCount,
  onConfirm,
  isPending,
}: DeleteListDialogProps) {
  const tailMessage = deleteTail(kind, entryCount);

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.lists_delete_title()}
      description={
        <>
          {m.lists_delete_confirm({ name: listName })} {tailMessage}
        </>
      }
      confirmLabel={m.common_delete()}
      pendingLabel={m.lists_delete_pending()}
      onConfirm={onConfirm}
      isPending={isPending}
    />
  );
}
