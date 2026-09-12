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
import { m } from "@/paraglide/messages.js";

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
      title={m.decks_dialog_share_title()}
      noun="deck"
      link={{
        url: shareUrl,
        label: m.decks_dialog_share_link_label(),
        exposes: m.decks_dialog_share_link_exposes(),
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
          <p className="text-muted-foreground text-sm">{m.decks_dialog_share_dirty_note()}</p>
        ) : undefined,
      }}
      qrFilenameBase={deckName || "deck"}
      print={{
        defaultTitle: deckName,
        defaultSubtitle: m.decks_dialog_share_print_subtitle(),
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
      title={m.decks_dialog_share_title()}
      noun="deck"
      description={m.decks_dialog_share_local_description()}
      noLinkNote={
        <p className="text-muted-foreground text-sm">{m.decks_dialog_share_local_no_link()}</p>
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
