import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import { Link } from "@tanstack/react-router";
import {
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  GitCompareArrowsIcon,
  ImageDownIcon,
  PrinterIcon,
} from "lucide-react";
import { useState } from "react";

import { PageTopBarIconButton } from "@/components/layout/page-top-bar";
import { ShareDialog } from "@/components/share/share-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeckExportDialog } from "@/features/decks/components/deck-export-dialog";
import { DeckPrintDialog } from "@/features/decks/components/deck-print-dialog";
import { useCopyDeckCode } from "@/features/decks/hooks/use-copy-deck-code";
import { toBuilderCardFromPublic } from "@/features/decks/lib/deck-builder-card";
import type { DeckLinkKind } from "@/features/decks/lib/deck-compare-side";
import { compareLinkParam } from "@/features/decks/lib/deck-compare-side";
import { toEncodeDeckCards } from "@/features/decks/lib/deck-encode-input";
import type { PublicDeckSource } from "@/features/decks/lib/public-deck-source";
import { deckShareImageUrl, shareImageOptions, shareImageVersion } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

interface PublicDeckActionsMenuProps {
  deckId: string;
  deckName: string;
  shareToken: string;
  linkKind: DeckLinkKind;
  updatedAt: string;
  cards: PublicDeckCardResponse[];
  extraOptions?: { label: string; description: string; cards: PublicDeckCardResponse[] }[];
  inTopBar?: boolean;
}

/**
 * Overflow menu on the two read-only deck pages, carrying only the actions
 * that need neither an account nor a session.
 */
export function PublicDeckActionsMenu({
  deckId,
  deckName,
  shareToken,
  linkKind,
  updatedAt,
  cards,
  extraOptions = [],
  inTopBar = false,
}: PublicDeckActionsMenuProps) {
  const [imageOpen, setImageOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const builderCards = cards.map((card) => toBuilderCardFromPublic(card));
  const publicSource: PublicDeckSource = {
    shareToken,
    imageVersion: shareImageVersion(updatedAt),
  };

  const deckCode = useCopyDeckCode(toEncodeDeckCards(builderCards));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            inTopBar ? (
              <PageTopBarIconButton aria-label={m.decks_menu_actions_label()} />
            ) : (
              <Button variant="ghost" size="icon" aria-label={m.decks_menu_actions_label()} />
            )
          }
        >
          <EllipsisVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void deckCode.copyCode()} disabled={deckCode.pending}>
            <CopyIcon className="size-4" />
            {m.decks_menu_copy_deck_code()}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link
                to="/decks/compare"
                search={{ from: compareLinkParam(linkKind, shareToken), to: undefined }}
              />
            }
          >
            <GitCompareArrowsIcon className="size-4" />
            {m.decks_editor_menu_compare()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setImageOpen(true)}>
            <ImageDownIcon className="size-4" />
            {m.decks_menu_save_image()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPrintOpen(true)}>
            <PrinterIcon className="size-4" />
            {m.decks_menu_print()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setExportOpen(true)}>
            <DownloadIcon className="size-4" />
            {m.decks_menu_export()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        title={m.decks_dialog_save_image_title()}
        description={m.decks_dialog_share_local_description()}
        noun="deck"
        image={{
          title: deckName,
          filename: { base: deckName, fallback: "deck", id: deckId },
          buildUrl: (choice) =>
            deckShareImageUrl(
              getSiteUrl(),
              shareToken,
              publicSource.imageVersion,
              shareImageOptions(choice),
            ),
          scales: [1, 2],
          qrNoun: "deck",
          qrAvailable: true,
        }}
      />

      <DeckPrintDialog
        deckId={deckId}
        deckName={deckName}
        cards={builderCards}
        publicSource={publicSource}
        open={printOpen}
        onOpenChange={setPrintOpen}
      />

      <DeckExportDialog
        deckId={deckId}
        isDirty={false}
        cards={builderCards}
        extraOptions={extraOptions.map((option) => ({
          ...option,
          cards: option.cards.map((card) => toBuilderCardFromPublic(card)),
        }))}
        publicSource={publicSource}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
    </>
  );
}
