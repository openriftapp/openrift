import { Link } from "@tanstack/react-router";
import { BookOpenIcon } from "lucide-react";
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
  useFriendGroupShareableCollections,
  useShareCollectionWithFriendGroup,
} from "@/features/groups/hooks/use-friend-group-sharing";
import { m } from "@/paraglide/messages.js";

export function ShareCollectionsWithGroupDialog({
  slug,
  groupName,
  open,
  onOpenChange,
  cancelLabel = m.common_cancel(),
  preselectAll = false,
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
          <DialogTitle>{m.share_collections_dialog_title({ group: groupName })}</DialogTitle>
          <DialogDescription>{m.share_collections_dialog_description()}</DialogDescription>
        </DialogHeader>
        <Suspense
          fallback={
            <div className="text-muted-foreground py-4 text-sm">
              {m.share_collections_dialog_loading()}
            </div>
          }
        >
          <ShareCollectionsBody
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

function ShareCollectionsBody({
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
  const { data } = useFriendGroupShareableCollections(slug);
  const share = useShareCollectionWithFriendGroup();

  const candidates = data.items.filter((item) => item.sharedAt === null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(preselectAll ? candidates.map((item) => item.collectionId) : []),
  );

  if (candidates.length === 0) {
    return (
      <>
        <p className="text-muted-foreground">
          {data.items.length === 0 ? (
            <>
              {m.share_collections_dialog_none_before()}{" "}
              <TextLink variant="muted" render={<Link to="/collections" />}>
                {m.share_dialog_create_one()}
              </TextLink>{" "}
              {m.share_dialog_none_after()}
            </>
          ) : (
            m.share_collections_dialog_all_shared()
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
    const toShare = candidates.filter((item) => selectedIds.has(item.collectionId));
    await Promise.allSettled(
      toShare.map((item) => share.mutateAsync({ slug, collectionId: item.collectionId })),
    );
    onOpenChange(false);
  };

  return (
    <DialogForm onSubmit={() => void handleShare()}>
      <ul className="flex flex-col gap-2">
        {candidates.map((item) => {
          const checkboxId = `share-collection-${item.collectionId}`;
          const isSelected = selectedIds.has(item.collectionId);
          return (
            <li key={item.collectionId} className="flex items-center gap-3">
              <Checkbox
                id={checkboxId}
                checked={isSelected}
                disabled={share.isPending}
                onCheckedChange={(checked) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (checked === false) {
                      next.delete(item.collectionId);
                    } else {
                      next.add(item.collectionId);
                    }
                    return next;
                  });
                }}
              />
              <label
                htmlFor={checkboxId}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
              >
                <BookOpenIcon className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate font-medium">{item.collectionName}</span>
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
          {selectedIds.size === 1
            ? m.share_collections_dialog_submit_one({ count: selectedIds.size })
            : m.share_collections_dialog_submit_other({ count: selectedIds.size })}
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}
