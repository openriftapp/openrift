import type { ListResponse } from "@openrift/shared/types/api/list";
import { useNavigate } from "@tanstack/react-router";
import { EyeIcon, EyeOffIcon, LinkIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useDeleteList, useSetListSidebarHidden } from "@/features/lists/hooks/use-lists";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

import { DeleteListDialog } from "./delete-list-dialog";
import { ListEditDialog } from "./list-edit-dialog";

interface ListRowMenuProps {
  list: ListResponse;
  isActive: boolean;
  children: ReactNode;
}

export function ListRowMenu({ list, isActive, children }: ListRowMenuProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { copy } = useCopyToClipboard();
  const setSidebarHidden = useSetListSidebarHidden();
  const deleteList = useDeleteList();
  const navigate = useNavigate();

  const shareUrl =
    list.isPublic && list.shareToken ? `${getSiteUrl()}/lists/share/${list.shareToken}` : null;

  // The menu closes on click, so the hook's inline "Copied" state never shows;
  // the toast is the feedback here instead.
  const handleCopyLink = async () => {
    if (!shareUrl) {
      return;
    }
    if (await copy(shareUrl)) {
      toast.success(m.lists_row_copy_success());
      return;
    }
    toast.error(m.lists_row_copy_error());
  };

  const handleDelete = () => {
    deleteList.mutate(list.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        if (isActive) {
          void navigate({ to: "/collections" });
        }
      },
    });
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          className="block select-none [-webkit-touch-callout:none]"
          render={<div />}
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => setEditOpen(true)}>
            <PencilIcon />
            {m.lists_row_edit()}
          </ContextMenuItem>
          {shareUrl && (
            <ContextMenuItem onClick={() => void handleCopyLink()}>
              <LinkIcon />
              {m.lists_row_copy_link()}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() =>
              setSidebarHidden.mutate({ listId: list.id, hidden: !list.sidebarHidden })
            }
          >
            {list.sidebarHidden ? <EyeIcon /> : <EyeOffIcon />}
            {list.sidebarHidden ? m.lists_row_show_in_sidebar() : m.lists_row_hide_in_sidebar()}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon />
            {m.lists_row_delete()}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {editOpen && (
        <ListEditDialog
          listId={list.id}
          intent={list.intent}
          currentName={list.name}
          currentTradeDefaults={list.tradeDefaults}
          currentCurrency={list.currency}
          open
          onOpenChange={setEditOpen}
        />
      )}
      {deleteOpen && (
        <DeleteListDialog
          open
          onOpenChange={setDeleteOpen}
          listName={list.name}
          kind={list.kind}
          entryCount={list.entryCount}
          onConfirm={handleDelete}
          isPending={deleteList.isPending}
        />
      )}
    </>
  );
}
