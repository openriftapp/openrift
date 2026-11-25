import type { AdminCardResponse } from "@openrift/shared/types/api/admin";
import { EllipsisVerticalIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDeleteCard,
  useLeaveCardPage,
  useRenameCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import type { RunWrite } from "@/features/admin/lib/run-write";

export function CardMenu({
  card,
  cardSlug,
  expectedCardId,
  runWrite,
  trigger,
  onRenamed,
  onDeleted,
}: {
  card: AdminCardResponse;
  cardSlug: string;
  expectedCardId: string;
  runWrite: RunWrite;
  trigger: ReactElement;
  onRenamed: (cardSlug: string) => Promise<unknown>;
  onDeleted: () => Promise<unknown>;
}) {
  const renameCard = useRenameCard();
  const deleteCard = useDeleteCard();
  const leaveCardPage = useLeaveCardPage();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isStale = cardSlug !== expectedCardId;

  async function regenerateId() {
    const input = { cardId: card.id, newId: expectedCardId };
    if (await runWrite((signal) => renameCard.mutateAsync(input, { signal }))) {
      await leaveCardPage(cardSlug, async () => {
        await onRenamed(expectedCardId);
      });
    }
  }

  async function confirmDelete() {
    if (await runWrite((signal) => deleteCard.mutateAsync(card.id, { signal }))) {
      setDeleteOpen(false);
      await leaveCardPage(cardSlug, async () => {
        await onDeleted();
      });
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger}>
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isStale && (
            <DropdownMenuItem disabled={renameCard.isPending} onClick={() => void regenerateId()}>
              <RefreshCwIcon />
              Regenerate ID ({cardSlug} &rarr; {expectedCardId})
            </DropdownMenuItem>
          )}
          {isStale && <DropdownMenuSeparator />}
          <DropdownMenuItem
            variant="destructive"
            disabled={deleteCard.isPending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
            Delete card…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete card "${card.name}"?`}
        description="This deletes the card and all its printings. This cannot be undone."
        confirmLabel="Delete card"
        destructive
        isPending={deleteCard.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
