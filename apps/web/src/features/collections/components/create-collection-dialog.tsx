import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateCollection } from "@/features/collections/hooks/use-collections";
import { m } from "@/paraglide/messages.js";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (collectionId: string) => void;
  groupSlug?: string;
  groupName?: string;
  title?: string;
  description?: string;
  availableForDeckbuilding?: boolean;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreated,
  groupSlug,
  groupName,
  title,
  description,
  availableForDeckbuilding,
}: CreateCollectionDialogProps) {
  const [name, setName] = useState("");
  const createCollection = useCreateCollection();
  const isShared = Boolean(groupSlug);
  const effectiveDescription =
    description ??
    (isShared
      ? m.collections_dialog_create_shared_description({
          group: groupName ?? m.collections_dialog_create_shared_group_fallback(),
        })
      : undefined);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName("");
    }
    onOpenChange(next);
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || createCollection.isPending) {
      return;
    }
    createCollection.mutate(
      {
        name: trimmed,
        ...(groupSlug ? { groupSlug } : {}),
        ...(availableForDeckbuilding === undefined ? {} : { availableForDeckbuilding }),
      },
      {
        onSuccess: (collection) => {
          onCreated?.(collection.id);
          handleOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {title ??
              (isShared
                ? m.collections_dialog_create_title_shared()
                : m.collections_dialog_create_title())}
          </DialogTitle>
          {effectiveDescription !== undefined && (
            <DialogDescription>{effectiveDescription}</DialogDescription>
          )}
        </DialogHeader>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <Input
            autoFocus // oxlint-disable-line jsx-a11y/no-autofocus -- intentional inside dialog
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={m.collections_dialog_collection_name_placeholder()}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={createCollection.isPending}
            >
              {m.common_cancel()}
            </Button>
            <Button type="submit" disabled={!name.trim() || createCollection.isPending}>
              {m.common_create()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
