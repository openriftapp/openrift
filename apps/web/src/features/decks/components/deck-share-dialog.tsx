import { useLocalDeckImageBody } from "@/features/decks/components/local-deck-image-body";
import { useShareDeck, useUnshareDeck } from "@/features/decks/hooks/use-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { isLocalDeckId } from "@/features/decks/lib/local-deck";
import { ShareDialog } from "@/features/groups/components/share-dialog";
import {
  deckImageFromCardsUrl,
  deckOwnerImageUrl,
  downloadImageFromPost,
  shareImageOptions,
} from "@/lib/share-image";
import { shareLinkUrl } from "@/lib/share-links";
import { getSiteUrl } from "@/lib/site-config";

interface DeckShareDialogProps {
  deckId: string;
  deckName: string;
  isPublic?: boolean;
  shareToken?: string | null;
  isDirty?: boolean;
  cards?: DeckBuilderCard[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ServerDeckShareDialog({
  deckId,
  deckName,
  isPublic = false,
  shareToken = null,
  isDirty = false,
  open,
  onOpenChange,
}: DeckShareDialogProps) {
  const shareDeck = useShareDeck();
  const unshareDeck = useUnshareDeck();

  const shareUrl = shareLinkUrl("deck", { shareToken, isPublic });

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Share deck"
      noun="deck"
      link={{
        url: shareUrl,
        label: "Deck share link",
        exposes:
          "view the deck, including your Plan (strategy, mulligans, and matchup notes), and copy it into their own decks",
        unfurls: true,
        onCreate: () => shareDeck.mutate(deckId),
        creating: shareDeck.isPending,
        onStop: () => unshareDeck.mutate(deckId),
        stopping: unshareDeck.isPending,
      }}
      image={{
        title: deckName,
        filenameBase: deckName || "deck",
        buildUrl: (choice) => deckOwnerImageUrl(getSiteUrl(), deckId, shareImageOptions(choice)),
        scales: [1, 2],
        qrNoun: "deck",
        qrAvailable: shareUrl !== null,
        note: isDirty ? (
          <p className="text-muted-foreground text-sm">
            You have unsaved changes. The image reflects the last saved state.
          </p>
        ) : undefined,
      }}
      qrFilenameBase={deckName || "deck"}
      print={{
        defaultTitle: deckName,
        defaultSubtitle: "Scan to see this deck",
        filenameHint: deckName,
      }}
    />
  );
}

function LocalDeckShareDialog({
  deckId,
  deckName,
  cards,
  open,
  onOpenChange,
}: DeckShareDialogProps) {
  const imageBody = useLocalDeckImageBody(deckId, deckName, cards);

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Share deck"
      noun="deck"
      description="Save an image of this deck to post in WhatsApp, Discord, or anywhere else."
      noLinkNote={
        <p className="text-muted-foreground text-sm">
          Save this deck to your account to get a share link.
        </p>
      }
      image={{
        title: deckName,
        filenameBase: deckName || "deck",
        // No server row to resolve by id, so the render is posted the cards instead: no GET URL, no preview.
        buildUrl: () => deckImageFromCardsUrl(getSiteUrl()),
        download: (choice, filename) =>
          downloadImageFromPost(
            deckImageFromCardsUrl(getSiteUrl(), { ...shareImageOptions(choice), qr: false }),
            imageBody(),
            filename,
          ),
        scales: [1, 2],
      }}
    />
  );
}

export function DeckShareDialog(props: DeckShareDialogProps) {
  if (isLocalDeckId(props.deckId)) {
    return <LocalDeckShareDialog {...props} />;
  }
  return <ServerDeckShareDialog {...props} />;
}
