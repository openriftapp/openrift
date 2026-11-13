import type { DeckFolderResponse, DeckListItemResponse } from "@openrift/shared/types/api/deck";
import type { DeckFormat } from "@openrift/shared/types/enums";
import { useNavigate } from "@tanstack/react-router";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BoxIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  FlaskConicalIcon,
  FolderIcon,
  GitBranchIcon,
  MonitorPlayIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PrinterIcon,
  RefreshCwIcon,
  SettingsIcon,
  Share2Icon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useBoxedDecks } from "@/features/decks/hooks/use-boxed-decks";
import { useDeckFolders, useSetDeckFolders } from "@/features/decks/hooks/use-deck-folders";
import { useDeckMenuActions } from "@/features/decks/hooks/use-deck-menu-actions";
import {
  useDeckCardsFor,
  useDeleteDeck,
  usePromoteDeckPrimary,
  useSetDeckArchived,
  useSetDeckPinned,
  useUpdateDeck,
} from "@/features/decks/hooks/use-decks";
import { useLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { toDeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { DeckFamilyEntry } from "@/features/decks/lib/deck-family";
import type {
  DeckMenuCapabilities,
  DeckMenuSource,
} from "@/features/decks/lib/deck-menu-capabilities";
import { deckMenuCapabilities } from "@/features/decks/lib/deck-menu-capabilities";
import { deleteLocalDeck } from "@/features/decks/lib/local-decks-collection";
import { useDeckFormatList } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

import { DeckExportDialog } from "./deck-export-dialog";
import { DeckPrintDialog } from "./deck-print-dialog";
import { DeckRenameDialog } from "./deck-rename-dialog";
import { DeckShareDialog } from "./deck-share-dialog";
import { DeckVariantsDialog } from "./deck-variants-dialog";
import { ManageDeckFoldersDialog } from "./manage-deck-folders-dialog";

type DeckMenuDialog = "share" | "export" | "print" | "rename" | "delete" | "folders" | "variants";

interface ServerOnlyActions {
  boxed: ReturnType<typeof useBoxedDecks>;
  handleTogglePin: () => void;
  folders: readonly DeckFolderResponse[];
  toggleFolder: (folderId: string) => void;
  handlePromotePrimary: () => void;
  handleToggleDraft: () => void;
  handleToggleArchive: () => void;
}

interface DeckMenuBodyProps {
  item: DeckListItemResponse;
  capabilities: DeckMenuCapabilities;
  dialog: DeckMenuDialog | null;
  setDialog: (dialog: DeckMenuDialog | null) => void;
  cards: DeckBuilderCard[] | undefined;
  remove: () => void;
  deletePending: boolean;
  deleteDescription: string;
  server?: ServerOnlyActions;
}

function toBuilderCards(
  rows: readonly Parameters<typeof toDeckBuilderCard>[0][],
  cardsById: ReturnType<typeof useCards>["cardsById"],
): DeckBuilderCard[] {
  return rows
    .map((card) => toDeckBuilderCard(card, cardsById))
    .filter((card): card is DeckBuilderCard => card !== null);
}

export function DeckActionsMenu({
  item,
  family,
  source,
}: {
  item: DeckListItemResponse;
  family?: DeckFamilyEntry;
  source: DeckMenuSource;
}) {
  return source === "server" ? (
    <ServerDeckActions item={item} family={family} />
  ) : (
    <LocalDeckActions item={item} />
  );
}

function ServerDeckActions({
  item,
  family,
}: {
  item: DeckListItemResponse;
  family?: DeckFamilyEntry;
}) {
  const { deck } = item;
  const boxed = useBoxedDecks(deck, family);
  const [dialog, setDialog] = useState<DeckMenuDialog | null>(null);
  const deleteDeck = useDeleteDeck();
  const updateDeck = useUpdateDeck();
  const setPinned = useSetDeckPinned();
  const setArchived = useSetDeckArchived();
  const promotePrimary = usePromoteDeckPrimary();
  const { data: folders } = useDeckFolders();
  const setDeckFolders = useSetDeckFolders();
  const { cardsById } = useCards();

  const needsCards = dialog === "share" || dialog === "export" || dialog === "print";
  const cardRows = useDeckCardsFor(needsCards ? [deck.id] : []);
  const cards = cardRows ? toBuilderCards(cardRows, cardsById) : undefined;

  return (
    <DeckMenuBody
      item={item}
      capabilities={deckMenuCapabilities("server")}
      dialog={dialog}
      setDialog={setDialog}
      cards={cards}
      remove={() => {
        // A second confirm while the delete is in flight 404s on the server.
        if (deleteDeck.isPending) {
          return;
        }
        deleteDeck.mutate(deck.id, { onSuccess: () => setDialog(null) });
      }}
      deletePending={deleteDeck.isPending}
      deleteDescription={m.decks_dialog_delete_description({ name: deck.name })}
      server={{
        boxed,
        handleTogglePin: () => setPinned.mutate({ deckId: deck.id, isPinned: !deck.isPinned }),
        folders: folders ?? [],
        // Folder membership is set wholesale; the toggle sends the full resulting set.
        toggleFolder: (folderId) =>
          setDeckFolders.mutate({
            id: deck.id,
            folderIds: item.folderIds.includes(folderId)
              ? item.folderIds.filter((id) => id !== folderId)
              : [...item.folderIds, folderId],
          }),
        handlePromotePrimary: () => promotePrimary.mutate(deck.id),
        handleToggleDraft: () => updateDeck.mutate({ deckId: deck.id, isDraft: !deck.isDraft }),
        handleToggleArchive: () =>
          setArchived.mutate({ deckId: deck.id, archived: deck.archivedAt === null }),
      }}
    />
  );
}

function LocalDeckActions({ item }: { item: DeckListItemResponse }) {
  const { deck } = item;
  const [dialog, setDialog] = useState<DeckMenuDialog | null>(null);
  const localDeck = useLocalDeck(deck.id);
  const { cardsById } = useCards();

  return (
    <DeckMenuBody
      item={item}
      capabilities={deckMenuCapabilities("local")}
      dialog={dialog}
      setDialog={setDialog}
      cards={localDeck ? toBuilderCards(localDeck.cards, cardsById) : []}
      remove={() => {
        deleteLocalDeck(deck.id);
        setDialog(null);
      }}
      deletePending={false}
      deleteDescription={m.decks_dialog_delete_local_description({ name: deck.name })}
    />
  );
}

function DeckMenuBody({
  item,
  capabilities,
  dialog,
  setDialog,
  cards,
  remove,
  deletePending,
  deleteDescription,
  server,
}: DeckMenuBodyProps) {
  const { deck } = item;
  const navigate = useNavigate();
  const { duplicate, changeFormat } = useDeckMenuActions(deck);
  const { formats } = useDeckFormatList();
  const otherFormats = formats.filter((entry) => entry.slug !== deck.format);
  const openChange = (target: DeckMenuDialog) => (open: boolean) => setDialog(open ? target : null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={m.decks_menu_actions_label()} />
          }
        >
          <EllipsisVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {server?.boxed.map((entry) => (
            <DropdownMenuItem
              key={entry.deckId}
              onClick={() => {
                void navigate({
                  to: "/collections/$collectionId",
                  params: { collectionId: entry.collectionId },
                });
              }}
            >
              <BoxIcon className="size-4" />
              {entry.deckId === deck.id && server.boxed.length === 1
                ? m.decks_meta_stored_in_box({ box: entry.boxName })
                : m.decks_meta_variant_in_box({ deck: entry.deckName, box: entry.boxName })}
            </DropdownMenuItem>
          ))}
          {server && server.boxed.length > 0 && <DropdownMenuSeparator />}
          {capabilities.pin && server ? (
            <DropdownMenuItem onClick={server.handleTogglePin}>
              {deck.isPinned ? (
                <>
                  <PinOffIcon className="size-4" />
                  {m.decks_menu_unpin()}
                </>
              ) : (
                <>
                  <PinIcon className="size-4" />
                  {m.decks_menu_pin()}
                </>
              )}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => setDialog("share")}>
            <Share2Icon className="size-4" />
            {m.decks_menu_share()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("export")}>
            <DownloadIcon className="size-4" />
            {m.decks_menu_export()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("print")}>
            <PrinterIcon className="size-4" />
            {m.decks_menu_print()}
          </DropdownMenuItem>
          {capabilities.present && item.totalCards > 0 ? (
            <DropdownMenuItem
              onClick={() => {
                void navigate({ to: "/stage", search: { deck: deck.id, i: 0 } });
              }}
            >
              <MonitorPlayIcon className="size-4" />
              {m.decks_menu_present()}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => setDialog("rename")}>
            <PencilIcon className="size-4" />
            {m.common_rename()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={duplicate}>
            <CopyIcon className="size-4" />
            {m.decks_menu_duplicate()}
          </DropdownMenuItem>
          {otherFormats.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <RefreshCwIcon className="size-4" />
                {m.decks_menu_change_format()}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {otherFormats.map((entry) => (
                  <DropdownMenuItem
                    key={entry.slug}
                    onClick={() => changeFormat(entry.slug as DeckFormat, entry.label)}
                  >
                    {entry.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          {capabilities.folders && server ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderIcon className="size-4" />
                {m.decks_menu_add_to_folder()}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {server.folders.map((folder) => (
                  <DropdownMenuCheckboxItem
                    key={folder.id}
                    checked={item.folderIds.includes(folder.id)}
                    onClick={() => server.toggleFolder(folder.id)}
                  >
                    {folder.name}
                  </DropdownMenuCheckboxItem>
                ))}
                {server.folders.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => setDialog("folders")}>
                  <SettingsIcon className="size-4" />
                  {m.decks_menu_manage_folders()}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          {capabilities.variants ? (
            <DropdownMenuItem onClick={() => setDialog("variants")}>
              <GitBranchIcon className="size-4" />
              {m.decks_menu_variants()}
            </DropdownMenuItem>
          ) : null}
          {capabilities.primary && server && deck.familyId !== null && !deck.isPrimary ? (
            <DropdownMenuItem onClick={server.handlePromotePrimary}>
              <StarIcon className="size-4" />
              {m.decks_menu_make_primary()}
            </DropdownMenuItem>
          ) : null}
          {capabilities.draft && server ? (
            <DropdownMenuItem onClick={server.handleToggleDraft}>
              <FlaskConicalIcon className="size-4" />
              {deck.isDraft ? m.decks_menu_unmark_draft() : m.decks_menu_mark_draft()}
            </DropdownMenuItem>
          ) : null}
          {capabilities.archive && server ? (
            <DropdownMenuItem onClick={server.handleToggleArchive}>
              {deck.archivedAt === null ? (
                <>
                  <ArchiveIcon className="size-4" />
                  {m.decks_menu_archive()}
                </>
              ) : (
                <>
                  <ArchiveRestoreIcon className="size-4" />
                  {m.decks_menu_unarchive()}
                </>
              )}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
            <Trash2Icon className="size-4" />
            {m.common_delete()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeckShareDialog
        deckId={deck.id}
        deckName={deck.name}
        isPublic={deck.isPublic}
        shareToken={deck.shareToken}
        open={dialog === "share"}
        onOpenChange={openChange("share")}
        cards={cards}
      />

      <DeckExportDialog
        deckId={deck.id}
        isDirty={false}
        open={dialog === "export"}
        onOpenChange={openChange("export")}
        cards={cards}
      />

      <DeckPrintDialog
        open={dialog === "print"}
        onOpenChange={openChange("print")}
        cards={cards}
        deckId={deck.id}
        deckName={deck.name}
      />

      <ConfirmActionDialog
        open={dialog === "delete"}
        onOpenChange={openChange("delete")}
        onConfirm={remove}
        isPending={deletePending}
        title={m.decks_dialog_delete_title()}
        description={deleteDescription}
        confirmLabel={m.common_delete()}
      />

      <DeckRenameDialog
        deckId={deck.id}
        currentName={deck.name}
        open={dialog === "rename"}
        onOpenChange={openChange("rename")}
      />

      {capabilities.variants ? (
        <DeckVariantsDialog
          deckId={deck.id}
          deckName={deck.name}
          open={dialog === "variants"}
          onOpenChange={openChange("variants")}
        />
      ) : null}

      {capabilities.folders ? (
        <ManageDeckFoldersDialog open={dialog === "folders"} onOpenChange={openChange("folders")} />
      ) : null}
    </>
  );
}
