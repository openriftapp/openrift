import type { AdminCardResponse } from "@openrift/shared/types/api/admin";
import { useNavigate } from "@tanstack/react-router";
import { EllipsisVerticalIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
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
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";

export function CardMenu({
  card,
  cardSlug,
  expectedCardId,
}: {
  card: AdminCardResponse;
  cardSlug: string;
  expectedCardId: string;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const navigate = useNavigate();
  const renameCard = useRenameCard();
  const deleteCard = useDeleteCard();
  const leaveCardPage = useLeaveCardPage();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isStale = cardSlug !== expectedCardId;

  async function regenerateId() {
    const input = { cardId: card.id, newId: expectedCardId };
    if (await queueWrite((signal) => renameCard.mutateAsync(input, { signal }))) {
      await leaveCardPage(cardSlug, () =>
        navigate({
          to: "/admin/workspace/cards/$cardSlug",
          params: { cardSlug: expectedCardId },
          ignoreBlocker: true,
        }),
      );
    }
  }

  async function confirmDelete() {
    if (await queueWrite((signal) => deleteCard.mutateAsync(card.id, { signal }))) {
      setDeleteOpen(false);
      await leaveCardPage(cardSlug, () =>
        navigate({ to: "/admin/workspace/cards", ignoreBlocker: true }),
      );
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Card actions" />}
        >
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
