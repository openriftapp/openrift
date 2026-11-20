import { useState } from "react";

import { ShareDialog } from "@/components/share/share-dialog";
import type { ShareImagePanelProps } from "@/components/share/share-image-panel";
import { ShareImagePanel } from "@/components/share/share-image-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeckSheetPrintPanel } from "@/features/decks/components/deck-print-dialog";
import { useShareDeck, useUnshareDeck } from "@/features/decks/hooks/use-decks";
import { useLocalDeckImageBody } from "@/features/decks/hooks/use-local-deck-image-body";
import { useIsLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { PublicDeckSource } from "@/features/decks/lib/public-deck-source";
import {
  deckImageFromCardsUrl,
  deckOwnerImageUrl,
  deckShareImageUrl,
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeckShareDialog({
  deckId,
  deckName,
  isPublic = false,
  shareToken = null,
  open,
  onOpenChange,
}: DeckShareDialogProps) {
  const shareDeck = useShareDeck();
  const unshareDeck = useUnshareDeck();

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.decks_dialog_share_title()}
      noun="deck"
      link={{
        url: shareLinkUrl("deck", { shareToken, isPublic }),
        label: m.decks_dialog_share_link_label(),
        exposes: m.decks_dialog_share_link_exposes(),
        unfurls: true,
        onCreate: () => shareDeck.mutate(deckId),
        creating: shareDeck.isPending,
        onStop: () => unshareDeck.mutate(deckId),
        stopping: unshareDeck.isPending,
      }}
      qrFilename={{ base: deckName, fallback: "deck", id: deckId }}
      print={{
        defaultTitle: deckName,
        defaultSubtitle: m.decks_dialog_share_print_subtitle(),
        filename: { base: deckName, fallback: "deck", id: deckId },
      }}
    />
  );
}

interface DeckImageDialogProps {
  deckId: string;
  deckName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPublic?: boolean;
  shareToken?: string | null;
  isDirty?: boolean;
  cards?: DeckBuilderCard[];
  publicSource?: PublicDeckSource;
}

function useDeckImagePanel({
  deckId,
  deckName,
  isPublic = false,
  shareToken = null,
  isDirty = false,
  cards,
  publicSource,
}: DeckImageDialogProps): ShareImagePanelProps {
  const isLocal = useIsLocalDeck(deckId);
  const imageBody = useLocalDeckImageBody(deckId, deckName, cards);
  const filename = { base: deckName, fallback: "deck", id: deckId };
  if (publicSource) {
    return {
      title: deckName,
      filename,
      buildUrl: (choice) =>
        deckShareImageUrl(
          getSiteUrl(),
          publicSource.shareToken,
          publicSource.imageVersion,
          shareImageOptions(choice),
        ),
      scales: [1, 2],
      qrNoun: "deck",
      qrAvailable: true,
    };
  }
  if (isLocal) {
    return {
      title: deckName,
      filename,
      // No server row to resolve by id, so the render is posted the cards instead: no GET URL, no preview.
      buildUrl: () => deckImageFromCardsUrl(getSiteUrl()),
      download: (choice, name) =>
        downloadImageFromPost(
          deckImageFromCardsUrl(getSiteUrl(), { ...shareImageOptions(choice), qr: false }),
          imageBody(),
          name,
        ),
      scales: [1, 2],
    };
  }
  return {
    title: deckName,
    filename,
    buildUrl: (choice) => deckOwnerImageUrl(getSiteUrl(), deckId, shareImageOptions(choice)),
    scales: [1, 2],
    qrNoun: "deck",
    qrAvailable: shareLinkUrl("deck", { shareToken, isPublic }) !== null,
    note: isDirty ? (
      <p className="text-muted-foreground text-sm">{m.decks_dialog_share_dirty_note()}</p>
    ) : undefined,
  };
}

export function DeckImageDialog(props: DeckImageDialogProps) {
  const {
    deckId,
    deckName,
    open,
    onOpenChange,
    cards,
    publicSource,
    isPublic = false,
    shareToken = null,
  } = props;
  const panel = useDeckImagePanel(props);
  const [tab, setTab] = useState("png");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.decks_dialog_save_image_title()}</DialogTitle>
          <DialogDescription>{m.decks_dialog_share_local_description()}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="png">{m.decks_dialog_image_tab_png()}</TabsTrigger>
            <TabsTrigger value="pdf">{m.decks_dialog_image_tab_pdf()}</TabsTrigger>
          </TabsList>
          <TabsContent value="png">
            {tab === "png" ? <ShareImagePanel {...panel} /> : null}
          </TabsContent>
          <TabsContent value="pdf">
            <DeckSheetPrintPanel
              deckId={deckId}
              deckName={deckName}
              cards={cards}
              publicSource={publicSource}
              isShared={shareLinkUrl("deck", { shareToken, isPublic }) !== null}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
