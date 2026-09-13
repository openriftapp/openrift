import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { HandshakeIcon, HeartIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { TextLink } from "@/components/ui/text-link";
import {
  useFriendGroupShareableLists,
  useShareListWithFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";
import { m } from "@/paraglide/messages.js";

export function ShareListsWithGroupDialog({
  slug,
  groupName,
  open,
  onOpenChange,
  cancelLabel = m.share_lists_dialog_skip(),
  preselectAll = true,
}: {
  slug: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cancelLabel?: string;
  preselectAll?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.share_lists_dialog_title({ group: groupName })}</DialogTitle>
          <DialogDescription>{m.share_lists_dialog_description()}</DialogDescription>
        </DialogHeader>
        <Suspense
          fallback={
            <div className="text-muted-foreground py-4 text-sm">
              {m.share_lists_dialog_loading()}
            </div>
          }
        >
          <ShareListsBody
            slug={slug}
            onOpenChange={onOpenChange}
            cancelLabel={cancelLabel}
            preselectAll={preselectAll}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function ShareListsBody({
  slug,
  onOpenChange,
  cancelLabel,
  preselectAll,
}: {
  slug: string;
  onOpenChange: (open: boolean) => void;
  cancelLabel: string;
  preselectAll: boolean;
}) {
  const { data } = useFriendGroupShareableLists(slug);
  const share = useShareListWithFriendGroup();

  const tradableLists = data.items.filter(
    (item) => item.listIntent === "wish" || item.listIntent === "trade",
  );
  const candidates = tradableLists.filter((item) => item.sharedAt === null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(preselectAll ? candidates.map((item) => item.listId) : []),
  );

  if (candidates.length === 0) {
    return (
      <>
        <p className="text-muted-foreground">
          {tradableLists.length === 0 ? (
            <ParaglideMessage
              message={m.share_lists_dialog_none}
              markup={{
                link: ({ children }) => (
                  <TextLink variant="muted" render={<Link to="/collections" />}>
                    {children}
                  </TextLink>
                ),
              }}
            />
          ) : (
            m.share_lists_dialog_all_shared()
          )}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {m.common_close()}
          </Button>
        </DialogFooter>
      </>
    );
  }

  const handleShare = async () => {
    const toShare = candidates.filter((item) => selectedIds.has(item.listId));
    await Promise.allSettled(
      toShare.map((item) => share.mutateAsync({ slug, listId: item.listId })),
    );
    onOpenChange(false);
  };

  return (
    <DialogForm onSubmit={() => void handleShare()}>
      <ul className="flex flex-col gap-2">
        {candidates.map((item) => {
          const checkboxId = `share-list-${item.listId}`;
          const isSelected = selectedIds.has(item.listId);
          return (
            <li key={item.listId} className="flex items-center gap-3">
              <Checkbox
                id={checkboxId}
                checked={isSelected}
                disabled={share.isPending}
                onCheckedChange={(checked) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (checked === false) {
                      next.delete(item.listId);
                    } else {
                      next.add(item.listId);
                    }
                    return next;
                  });
                }}
              />
              <label
                htmlFor={checkboxId}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
              >
                {item.listIntent === "wish" ? (
                  <HeartIcon className="text-muted-foreground size-4 shrink-0" />
                ) : (
                  <HandshakeIcon className="text-muted-foreground size-4 shrink-0" />
                )}
                <span className="truncate font-medium">{item.listName}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {m.common_cards({ count: item.entryCount })}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={share.isPending}>
          {cancelLabel}
        </Button>
        <Button type="submit" disabled={share.isPending || selectedIds.size === 0}>
          {m.share_lists_dialog_submit({ count: selectedIds.size })}
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}
