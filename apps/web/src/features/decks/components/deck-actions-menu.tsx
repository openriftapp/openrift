import type { DeckListItemResponse } from "@openrift/shared/types/api/deck";
import type { DeckFormat } from "@openrift/shared/types/enums";
import { useRouter } from "@tanstack/react-router";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCards } from "@/features/cards/hooks/use-cards";
import { DeckCopyFallbackDialog } from "@/features/decks/components/deck-copy-fallback-dialog";
import { DeckCoverPickerDialog } from "@/features/decks/components/deck-cover-dialog";
import { DeckDetailsDialog } from "@/features/decks/components/deck-details-dialog";
import { DeckHomeCollectionDialog } from "@/features/decks/components/deck-home-collection-dialog";
import { DeckMenuContent } from "@/features/decks/components/deck-menu-content";
import { DeckPrintDialog } from "@/features/decks/components/deck-print-dialog";
import { DeckRenameDialog } from "@/features/decks/components/deck-rename-dialog";
import { DeckImageDialog, DeckShareDialog } from "@/features/decks/components/deck-share-dialog";
import { DeckVariantCreateDialog } from "@/features/decks/components/deck-variant-create-dialog";
import { DeckVariantsDialog } from "@/features/decks/components/deck-variants-dialog";
import { ManageDeckFoldersDialog } from "@/features/decks/components/manage-deck-folders-dialog";
import { useBoxedDecks } from "@/features/decks/hooks/use-boxed-decks";
import type { DeckCopySource } from "@/features/decks/hooks/use-deck-copy";
import { useDeckMenuActions } from "@/features/decks/hooks/use-deck-menu-actions";
import type { DeckMenuRuns } from "@/features/decks/hooks/use-deck-menu-runs";
import {
  useDeckOutputRuns,
  useServerDeckMenuRuns,
} from "@/features/decks/hooks/use-deck-menu-runs";
import { useDeckCardsFor, useDeleteDeck } from "@/features/decks/hooks/use-decks";
import { useLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { toDraftDeckCard } from "@/features/decks/lib/deck-builder-card";
import { toEncodeDeckCards } from "@/features/decks/lib/deck-encode-input";
import type { DeckFamilyEntry } from "@/features/decks/lib/deck-family";
import type { DeckMenuAction } from "@/features/decks/lib/deck-menu-model";
import { deckMenuModel } from "@/features/decks/lib/deck-menu-model";
import { deleteLocalDeck } from "@/features/decks/lib/local-decks-collection";
import { preloadStageShow } from "@/features/stage/hooks/use-preload-stage-show";
import { useDeckFormatList } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

type RowDialog =
  | "link"
  | "image"
  | "proxies"
  | "registration"
  | "storedIn"
  | "details"
  | "rename"
  | "cover"
  | "newVariant"
  | "variants"
  | "folders"
  | "delete";

const NEEDS_CARDS: ReadonlySet<RowDialog> = new Set(["proxies", "registration", "cover"]);

interface ServerRowExtras {
  boxed: ReturnType<typeof useBoxedDecks>;
  folders: readonly { id: string; name: string; checked: boolean }[];
  run: DeckMenuRuns;
  toggleFolder: (folderId: string) => void;
}

interface RowMenuProps {
  item: DeckListItemResponse;
  dialog: RowDialog | null;
  setDialog: (dialog: RowDialog | null) => void;
  cards: DeckBuilderCard[] | undefined;
  copySource: () => DeckCopySource;
  remove: () => void;
  deletePending: boolean;
  deleteDescription: string;
  server?: ServerRowExtras;
}

function toBuilderCards(
  rows: readonly Parameters<typeof toDraftDeckCard>[0][],
  cardsById: ReturnType<typeof useCards>["cardsById"],
): DeckBuilderCard[] {
  return rows.map((card) => toDraftDeckCard(card, cardsById));
}

export function DeckActionsMenu({
  item,
  family,
  source,
}: {
  item: DeckListItemResponse;
  family?: DeckFamilyEntry;
  source: "server" | "local";
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
  const [dialog, setDialog] = useState<RowDialog | null>(null);
  const deleteDeck = useDeleteDeck();
  const serverRuns = useServerDeckMenuRuns(deck, item.folderIds);
  const { cardsById } = useCards();

  const cardRows = useDeckCardsFor(dialog !== null && NEEDS_CARDS.has(dialog) ? [deck.id] : []);
  const cards = cardRows ? toBuilderCards(cardRows, cardsById) : undefined;

  return (
    <RowMenu
      item={item}
      dialog={dialog}
      setDialog={setDialog}
      cards={cards}
      copySource={() => ({ deckId: deck.id })}
      remove={() => {
        // A second confirm while the delete is in flight 404s on the server.
        if (deleteDeck.isPending) {
          return;
        }
        deleteDeck.mutate(deck.id, { onSuccess: () => setDialog(null) });
      }}
      deletePending={deleteDeck.isPending}
      deleteDescription={m.decks_dialog_delete_description({ name: deck.name })}
      server={{ ...serverRuns, boxed }}
    />
  );
}

function LocalDeckActions({ item }: { item: DeckListItemResponse }) {
  const { deck } = item;
  const [dialog, setDialog] = useState<RowDialog | null>(null);
  const localDeck = useLocalDeck(deck.id);
  const { cardsById } = useCards();
  const cards = localDeck ? toBuilderCards(localDeck.cards, cardsById) : [];

  return (
    <RowMenu
      item={item}
      dialog={dialog}
      setDialog={setDialog}
      cards={cards}
      copySource={() => ({ cards: toEncodeDeckCards(cards) })}
      remove={() => {
        deleteLocalDeck(deck.id);
        setDialog(null);
      }}
      deletePending={false}
      deleteDescription={m.decks_dialog_delete_local_description({ name: deck.name })}
    />
  );
}

const DIALOG_OF: Partial<Record<DeckMenuAction, RowDialog>> = {
  shareLink: "link",
  saveImage: "image",
  printProxies: "proxies",
  printRegistration: "registration",
  storedIn: "storedIn",
  details: "details",
  rename: "rename",
  cover: "cover",
  newVariant: "newVariant",
  variants: "variants",
  delete: "delete",
};

function RowMenu({
  item,
  dialog,
  setDialog,
  cards,
  copySource,
  remove,
  deletePending,
  deleteDescription,
  server,
}: RowMenuProps) {
  const { deck } = item;
  const router = useRouter();
  const { duplicate, changeFormat } = useDeckMenuActions(deck);
  const { formats } = useDeckFormatList();
  const otherFormats = formats.filter((entry) => entry.slug !== deck.format);
  const outputs = useDeckOutputRuns(copySource, server ? deck.id : undefined);
  const model = deckMenuModel({
    context: "row",
    server: server !== undefined,
    cardCount: item.totalCards,
    archived: deck.archivedAt !== null,
    isVariant: deck.familyId !== null,
    isPrimary: deck.isPrimary,
    hasOtherFormats: otherFormats.length > 0,
  });
  const openChange = (target: RowDialog) => (open: boolean) => setDialog(open ? target : null);
  const ownBox = server?.boxed.find((entry) => entry.deckId === deck.id);

  const onAction = (action: DeckMenuAction) => {
    const target = DIALOG_OF[action];
    if (target) {
      setDialog(target);
      return;
    }
    (
      server?.run[action] ??
      outputs.run[action] ??
      (action === "duplicate" ? duplicate : undefined)
    )?.();
  };

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open && server && item.totalCards > 0) {
            preloadStageShow(router, { deck: deck.id });
          }
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={m.decks_menu_actions_label()} />
          }
        >
          <EllipsisVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DeckMenuContent
            model={model}
            context="row"
            deck={{
              isPinned: deck.isPinned,
              isDraft: deck.isDraft,
              archived: deck.archivedAt !== null,
            }}
            boxName={ownBox?.boxName}
            compareFrom={deck.id}
            formats={otherFormats}
            folders={server?.folders}
            onAction={onAction}
            onFormat={(slug, label) => changeFormat(slug as DeckFormat, label)}
            onToggleFolder={server?.toggleFolder}
            onManageFolders={() => setDialog("folders")}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "link" && (
        <DeckShareDialog
          open
          onOpenChange={openChange("link")}
          deckId={deck.id}
          deckName={deck.name}
          isPublic={deck.isPublic}
          shareToken={deck.shareToken}
        />
      )}
      {dialog === "image" && (
        <DeckImageDialog
          open
          onOpenChange={openChange("image")}
          deckId={deck.id}
          deckName={deck.name}
          isPublic={deck.isPublic}
          shareToken={deck.shareToken}
          cards={cards}
        />
      )}
      {(dialog === "proxies" || dialog === "registration") && (
        <DeckPrintDialog
          open
          kind={dialog}
          onOpenChange={openChange(dialog)}
          cards={cards}
          deckId={deck.id}
          deckName={deck.name}
        />
      )}
      {dialog === "storedIn" && server && (
        <DeckHomeCollectionDialog
          open
          onOpenChange={openChange("storedIn")}
          deckId={deck.id}
          currentCollectionId={deck.collectionId}
          stored={server.boxed}
        />
      )}
      {dialog === "details" && (
        <DeckDetailsDialog
          open
          onOpenChange={openChange("details")}
          deckId={deck.id}
          currentName={deck.name}
          currentDescription={deck.description}
          currentLinks={deck.links}
        />
      )}
      {dialog === "rename" && (
        <DeckRenameDialog
          open
          onOpenChange={openChange("rename")}
          deckId={deck.id}
          currentName={deck.name}
        />
      )}
      {dialog === "cover" && cards && (
        <DeckCoverPickerDialog
          open
          onOpenChange={openChange("cover")}
          deckId={deck.id}
          cards={cards}
          coverCardId={deck.coverCardId}
          coverFaceId={deck.coverFaceId}
          coverPosition={deck.coverPosition}
        />
      )}
      {dialog === "newVariant" && (
        <DeckVariantCreateDialog
          open
          onOpenChange={openChange("newVariant")}
          deckId={deck.id}
          deckName={deck.name}
        />
      )}
      {dialog === "variants" && (
        <DeckVariantsDialog
          open
          onOpenChange={openChange("variants")}
          deckId={deck.id}
          deckName={deck.name}
        />
      )}
      {dialog === "folders" && (
        <ManageDeckFoldersDialog open onOpenChange={openChange("folders")} />
      )}

      <ConfirmActionDialog
        open={dialog === "delete"}
        onOpenChange={openChange("delete")}
        onConfirm={remove}
        isPending={deletePending}
        title={m.decks_dialog_delete_title()}
        description={deleteDescription}
        confirmLabel={m.common_delete()}
      />
      <DeckCopyFallbackDialog fallback={outputs.fallback} onClose={() => outputs.closeFallback()} />
    </>
  );
}
