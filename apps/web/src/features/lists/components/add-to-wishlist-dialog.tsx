import type { ListKind } from "@openrift/shared/types/api/list";
import { HeartIcon } from "lucide-react";
import { toast } from "sonner";

import { PickerDialog } from "@/components/picker-dialog";
import { useBulkAddListEntries, useLists } from "@/features/lists/hooks/use-lists";
import type { InitialEntry } from "@/features/lists/lib/list-initial-entry";
import { m } from "@/paraglide/messages.js";

function kindLabel(kind: ListKind): string {
  switch (kind) {
    case "card": {
      return m.lists_add_kind_card();
    }
    case "printing": {
      return m.lists_add_kind_printing();
    }
    case "copy": {
      return "";
    }
  }
}

interface AddToWishlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entriesFor: (kind: ListKind) => InitialEntry[];
  onCreateNew: () => void;
  onAdded?: (listId: string) => void;
}

/** Adds a prepared set of cards to an existing wishlist, or hands off to the create-wishlist flow. */
export function AddToWishlistDialog({
  open,
  onOpenChange,
  entriesFor,
  onCreateNew,
  onAdded,
}: AddToWishlistDialogProps) {
  const { data: wishlists } = useLists("wish");
  const bulkAdd = useBulkAddListEntries();

  const addToList = (listId: string, listName: string, kind: ListKind) => {
    const entries = entriesFor(kind);
    if (entries.length === 0) {
      toast.info(m.lists_add_nothing_to_add({ list: listName }));
      return;
    }
    bulkAdd.mutate(
      { listId, entries },
      {
        onSuccess: (result) => {
          const total = result.added + result.updated;
          toast.success(m.lists_add_added_cards({ count: total, list: listName }));
          onAdded?.(listId);
          onOpenChange(false);
        },
      },
    );
  };

  const handleCreateNew = () => {
    onOpenChange(false);
    onCreateNew();
  };

  return (
    <PickerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.lists_add_wishlist_title()}
      options={wishlists.map((list) => ({
        value: list.id,
        label: list.name,
        icon: <HeartIcon className="size-4 shrink-0" />,
        meta: kindLabel(list.kind),
      }))}
      emptyText={m.lists_add_no_wishlists()}
      pending={bulkAdd.isPending}
      onPick={(listId) => {
        const list = wishlists.find((candidate) => candidate.id === listId);
        if (list) {
          addToList(list.id, list.name, list.kind);
        }
      }}
      create={{
        actions: [{ key: "wish", label: m.lists_add_new_wishlist(), onClick: handleCreateNew }],
        disabled: bulkAdd.isPending,
      }}
    />
  );
}
