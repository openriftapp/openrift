import type { DeckDetailResponse } from "@openrift/shared/types/api/deck";
import type { DeckFormat } from "@openrift/shared/types/enums";
import { useNavigate } from "@tanstack/react-router";
import { EllipsisVerticalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageTopBarIconButton } from "@/components/layout/page-top-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeckCopyFallbackDialog } from "@/features/decks/components/deck-copy-fallback-dialog";
import { DeckMenuContent } from "@/features/decks/components/deck-menu-content";
import { useBoxedDecks } from "@/features/decks/hooks/use-boxed-decks";
import type { DeckEditorDialog } from "@/features/decks/hooks/use-deck-editor-dialogs";
import { useDeckMenuActions } from "@/features/decks/hooks/use-deck-menu-actions";
import type { DeckMenuRuns } from "@/features/decks/hooks/use-deck-menu-runs";
import {
  useDeckOutputRuns,
  useServerDeckMenuRuns,
} from "@/features/decks/hooks/use-deck-menu-runs";
import { useDeckList } from "@/features/decks/hooks/use-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { toEncodeDeckCards } from "@/features/decks/lib/deck-encode-input";
import type { DeckMenuAction } from "@/features/decks/lib/deck-menu-model";
import { deckMenuModel } from "@/features/decks/lib/deck-menu-model";
import { useDeckFormatList } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

interface DeckEditorMenuProps {
  deckId: string;
  deck: DeckDetailResponse["deck"];
  cards: DeckBuilderCard[];
  isLocal: boolean;
  openDialog: (dialog: DeckEditorDialog) => void;
  prefix?: ReactNode;
}

interface ServerExtras {
  run: DeckMenuRuns;
  boxName?: string;
  folders: readonly { id: string; name: string; checked: boolean }[];
  toggleFolder: (folderId: string) => void;
}

const DIALOG_OF: Partial<Record<DeckMenuAction, DeckEditorDialog>> = {
  shareLink: "share",
  saveImage: "image",
  printProxies: "proxies",
  printRegistration: "registration",
  storedIn: "homeCollection",
  details: "details",
  rename: "rename",
  cover: "cover",
  newVariant: "variantCreate",
  variants: "variants",
  delete: "delete",
};

/**
 * The editor's overflow menu. A browser-local deck may belong to a signed-out
 * viewer, so it skips the account-only hooks.
 */
export function DeckEditorMenu(props: DeckEditorMenuProps) {
  return props.isLocal ? <EditorMenuBody {...props} /> : <ServerEditorMenu {...props} />;
}

function ServerEditorMenu(props: DeckEditorMenuProps) {
  const { deckId, deck } = props;
  const folderIds = useDeckList()?.find((entry) => entry.deck.id === deckId)?.folderIds ?? [];
  const serverRuns = useServerDeckMenuRuns({ ...deck, id: deckId }, folderIds);
  const boxed = useBoxedDecks({ id: deckId, name: deck.name, collectionId: deck.collectionId });

  return (
    <EditorMenuBody
      {...props}
      server={{ ...serverRuns, boxName: boxed.find((entry) => entry.deckId === deckId)?.boxName }}
    />
  );
}

function EditorMenuBody({
  deckId,
  deck,
  cards,
  openDialog,
  prefix,
  server,
}: DeckEditorMenuProps & { server?: ServerExtras }) {
  const navigate = useNavigate();
  const { formats } = useDeckFormatList();
  const otherFormats = formats.filter((entry) => entry.slug !== deck.format);
  const { duplicate, changeFormat } = useDeckMenuActions({ id: deckId, name: deck.name });
  const outputs = useDeckOutputRuns(
    () => ({ cards: toEncodeDeckCards(cards) }),
    server ? deckId : undefined,
  );
  const archived = deck.archivedAt !== null;
  const model = deckMenuModel({
    context: "editor",
    server: server !== undefined,
    cardCount: cards.reduce((sum, card) => sum + card.quantity, 0),
    archived,
    isVariant: deck.familyId !== null,
    isPrimary: deck.isPrimary,
    hasOtherFormats: otherFormats.length > 0,
  });
  const ownRuns: DeckMenuRuns = {
    duplicate,
    importReplace: () => {
      void navigate({ to: "/decks/import", search: { replaceDeckId: deckId } });
    },
  };

  const onAction = (action: DeckMenuAction) => {
    const dialog = DIALOG_OF[action];
    if (dialog) {
      openDialog(dialog);
      return;
    }
    (server?.run[action] ?? outputs.run[action] ?? ownRuns[action])?.();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<PageTopBarIconButton />}>
          <EllipsisVerticalIcon className="size-4" />
          <span className="sr-only">{m.decks_editor_deck_actions()}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DeckMenuContent
            model={model}
            context="editor"
            deck={{ isPinned: deck.isPinned, isDraft: deck.isDraft, archived }}
            boxName={server?.boxName}
            compareFrom={deckId}
            formats={otherFormats}
            folders={server?.folders}
            prefix={prefix}
            onAction={onAction}
            onFormat={(slug, label) => changeFormat(slug as DeckFormat, label)}
            onToggleFolder={server?.toggleFolder}
            onManageFolders={() => openDialog("folders")}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <DeckCopyFallbackDialog fallback={outputs.fallback} onClose={() => outputs.closeFallback()} />
    </>
  );
}
