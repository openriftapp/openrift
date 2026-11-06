import type { DeckFolderResponse, DeckListItemResponse } from "@openrift/shared/types/api/deck";
import { ArchiveIcon, ArchiveRestoreIcon, FolderIcon, FolderMinusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FloatingActionBar } from "@/components/floating-action-bar";
import { PickerDialog } from "@/components/picker-dialog";
import { useCreateDeckFolder } from "@/features/decks/hooks/use-deck-folders";
import { useBulkUpdateDecks } from "@/features/decks/hooks/use-decks";
import type { DeckBulkChange } from "@/features/decks/lib/decks-write";
import { m } from "@/paraglide/messages.js";

export function DeckSelectionBar({
  items,
  folders,
  onClear,
}: {
  items: DeckListItemResponse[];
  folders: DeckFolderResponse[];
  onClear: () => void;
}) {
  const bulkUpdate = useBulkUpdateDecks();
  const createFolder = useCreateDeckFolder();
  const [picker, setPicker] = useState<"add" | "remove" | null>(null);

  if (items.length === 0) {
    return null;
  }

  const deckIds = items.map((item) => item.deck.id);
  const hasUnarchived = items.some((item) => item.deck.archivedAt === null);
  const hasArchived = items.some((item) => item.deck.archivedAt !== null);
  const filedCount = (folderId: string) =>
    items.filter((item) => item.folderIds.includes(folderId)).length;
  const foldersInSelection = folders.filter((folder) => filedCount(folder.id) > 0);
  const isPending = bulkUpdate.isPending || createFolder.isPending;

  const apply = (change: DeckBulkChange, describe: (count: number) => string) => {
    bulkUpdate.mutate(
      { deckIds, change },
      {
        onSuccess: (count) => {
          if (count > 0) {
            toast.success(describe(count));
          }
          setPicker(null);
          onClear();
        },
      },
    );
  };

  const addTo = (folder: DeckFolderResponse) => {
    apply({ kind: "addToFolder", folderId: folder.id }, (count) =>
      m.decks_selection_added({ count, folder: folder.name }),
    );
  };

  const removeFrom = (folder: DeckFolderResponse) => {
    apply({ kind: "removeFromFolder", folderId: folder.id }, (count) =>
      m.decks_selection_removed({ count, folder: folder.name }),
    );
  };

  const pickFolder = (folderId: string, run: (folder: DeckFolderResponse) => void) => {
    const folder = folders.find((entry) => entry.id === folderId);
    if (folder) {
      run(folder);
    }
  };

  const actions = [
    ...(hasUnarchived
      ? [
          {
            label: m.decks_menu_archive(),
            icon: <ArchiveIcon />,
            disabled: isPending,
            onClick: () =>
              apply({ kind: "archive", archived: true }, (count) =>
                m.decks_selection_archived({ count }),
              ),
          },
        ]
      : []),
    ...(hasArchived
      ? [
          {
            label: m.decks_menu_unarchive(),
            icon: <ArchiveRestoreIcon />,
            disabled: isPending,
            onClick: () =>
              apply({ kind: "archive", archived: false }, (count) =>
                m.decks_selection_unarchived({ count }),
              ),
          },
        ]
      : []),
    {
      label: m.decks_menu_add_to_folder(),
      icon: <FolderIcon />,
      disabled: isPending,
      onClick: () => setPicker("add"),
    },
    ...(foldersInSelection.length > 0
      ? [
          {
            label: m.decks_selection_remove_from_folder(),
            icon: <FolderMinusIcon />,
            disabled: isPending,
            onClick: () => setPicker("remove"),
          },
        ]
      : []),
  ];

  return (
    <>
      <FloatingActionBar selectedCount={items.length} actions={actions} onClear={onClear} />

      <PickerDialog
        open={picker === "add"}
        onOpenChange={(open) => setPicker(open ? "add" : null)}
        title={m.decks_selection_add_title({ count: items.length })}
        options={folders.map((folder) => ({
          value: folder.id,
          label: folder.name,
          icon: <FolderIcon className="size-4 shrink-0" />,
          disabled: filedCount(folder.id) === items.length,
        }))}
        emptyText={m.decks_selection_no_folders()}
        pending={isPending}
        onPick={(folderId) => pickFolder(folderId, addTo)}
        create={{
          actions: [
            {
              key: "folder",
              label: m.decks_dialog_folders_new_label(),
              placeholder: m.decks_dialog_folders_new_placeholder(),
            },
          ],
          disabled: isPending,
          onCreate: (_key, name, done) => {
            createFolder.mutate(
              { name },
              {
                onSuccess: (folder) => {
                  done();
                  addTo(folder);
                },
              },
            );
          },
        }}
      />

      <PickerDialog
        open={picker === "remove"}
        onOpenChange={(open) => setPicker(open ? "remove" : null)}
        title={m.decks_selection_remove_title({ count: items.length })}
        options={foldersInSelection.map((folder) => ({
          value: folder.id,
          label: folder.name,
          icon: <FolderIcon className="size-4 shrink-0" />,
          meta: m.decks_dialog_folders_deck_count({ count: filedCount(folder.id) }),
        }))}
        emptyText={null}
        pending={isPending}
        onPick={(folderId) => pickFolder(folderId, removeFrom)}
      />
    </>
  );
}
