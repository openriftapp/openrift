import { useNavigate } from "@tanstack/react-router";

import type { DeckCopySource } from "@/features/decks/hooks/use-deck-copy";
import { useDeckCopy } from "@/features/decks/hooks/use-deck-copy";
import { useDeckFolders, useSetDeckFolders } from "@/features/decks/hooks/use-deck-folders";
import {
  usePromoteDeckPrimary,
  useSetDeckArchived,
  useSetDeckPinned,
  useUpdateDeck,
} from "@/features/decks/hooks/use-decks";
import { usePlayOnRiftAtlas } from "@/features/decks/hooks/use-play-on-riftatlas";
import type { DeckMenuAction } from "@/features/decks/lib/deck-menu-model";

export type DeckMenuRuns = Partial<Record<DeckMenuAction, () => void>>;

export function useDeckOutputRuns(copySource: () => DeckCopySource, presentDeckId?: string) {
  const navigate = useNavigate();
  const deckCopy = useDeckCopy(copySource);
  const play = usePlayOnRiftAtlas(copySource);
  const run: DeckMenuRuns = {
    play,
    copyText: () => deckCopy.copy("text"),
    copyCode: () => deckCopy.copy("piltover"),
    copyTts: () => deckCopy.copy("tts"),
  };
  if (presentDeckId !== undefined) {
    run.present = () => {
      void navigate({ to: "/stage/show", search: { deck: presentDeckId, i: 0 } });
    };
  }
  return { run, fallback: deckCopy.fallback, closeFallback: deckCopy.closeFallback };
}

/** Account-only entries of a server deck; never call it for a browser-local deck. */
export function useServerDeckMenuRuns(
  deck: { id: string; isPinned: boolean; isDraft: boolean; archivedAt: string | null },
  folderIds: readonly string[],
) {
  const updateDeck = useUpdateDeck();
  const setPinned = useSetDeckPinned();
  const setArchived = useSetDeckArchived();
  const promotePrimary = usePromoteDeckPrimary();
  const setDeckFolders = useSetDeckFolders();
  const { data: deckFolders } = useDeckFolders();

  const run: DeckMenuRuns = {
    pin: () => setPinned.mutate({ deckId: deck.id, isPinned: !deck.isPinned }),
    makePrimary: () => promotePrimary.mutate(deck.id),
    draft: () => updateDeck.mutate({ deckId: deck.id, isDraft: !deck.isDraft }),
    archive: () => setArchived.mutate({ deckId: deck.id, archived: deck.archivedAt === null }),
    unarchive: () => setArchived.mutate({ deckId: deck.id, archived: false }),
  };
  return {
    run,
    folders: (deckFolders ?? []).map((folder) => ({
      id: folder.id,
      name: folder.name,
      checked: folderIds.includes(folder.id),
    })),
    toggleFolder: (folderId: string) =>
      setDeckFolders.mutate({
        id: deck.id,
        folderIds: folderIds.includes(folderId)
          ? folderIds.filter((id) => id !== folderId)
          : [...folderIds, folderId],
      }),
  };
}
