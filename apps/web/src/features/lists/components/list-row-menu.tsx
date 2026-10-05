import type { ListResponse } from "@openrift/shared/types/api/list";
import { CatchBoundary, useNavigate } from "@tanstack/react-router";
import { EyeIcon, EyeOffIcon, LinkIcon, PencilIcon, Share2Icon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DeleteListDialog } from "@/features/lists/components/delete-list-dialog";
import { ListEditDialog } from "@/features/lists/components/list-edit-dialog";
import { ListShareDialog } from "@/features/lists/components/list-share-dialog";
import {
  useDeleteList,
  useListDetail,
  useSetListSidebarHidden,
} from "@/features/lists/hooks/use-lists";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { shareLinkUrl } from "@/lib/share-links";
import { m } from "@/paraglide/messages.js";

interface ListRowMenuProps {
  list: ListResponse;
  isActive: boolean;
  children: ReactNode;
}

export function ListRowMenu({ list, isActive, children }: ListRowMenuProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { copy } = useCopyToClipboard();
  const setSidebarHidden = useSetListSidebarHidden();
  const deleteList = useDeleteList();
  const navigate = useNavigate();

  const shareUrl = shareLinkUrl("list", list);

  // The menu closes on click, so the hook's inline "Copied" state never shows;
  // the toast is the feedback here instead.
  const handleCopyLink = async () => {
    if (!shareUrl) {
      return;
    }
    if (await copy(shareUrl)) {
      toast.success(m.common_share_link_copied());
      return;
    }
    toast.error(m.common_copy_link_error());
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
          <ContextMenuItem onClick={() => setShareOpen(true)}>
            <Share2Icon />
            {m.lists_page_share()}
          </ContextMenuItem>
          {shareUrl && (
            <ContextMenuItem onClick={() => void handleCopyLink()}>
              <LinkIcon />
              {m.common_copy_share_link()}
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
      {shareOpen && (
        <CatchBoundary getResetKey={() => list.id} errorComponent={() => null}>
          <Suspense fallback={null}>
            <ListRowShareDialog list={list} onOpenChange={setShareOpen} />
          </Suspense>
        </CatchBoundary>
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

/** Reads the entries the share text needs, so it mounts only while open. */
function ListRowShareDialog({
  list,
  onOpenChange,
}: {
  list: ListResponse;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useListDetail(list.id);
  return (
    <ListShareDialog
      listId={list.id}
      listName={data.list.name}
      kind={data.list.kind}
      intent={data.list.intent}
      tradeDefaults={data.list.tradeDefaults}
      currency={data.list.currency}
      isPublic={data.list.isPublic}
      shareToken={data.list.shareToken}
      updatedAt={data.list.updatedAt}
      entries={data.entries}
      open
      onOpenChange={onOpenChange}
    />
  );
}
