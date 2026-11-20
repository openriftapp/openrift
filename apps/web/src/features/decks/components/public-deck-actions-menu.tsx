import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";

import { PageTopBarIconButton } from "@/components/layout/page-top-bar";
import { ShareDialog } from "@/components/share/share-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeckCopyFallbackDialog } from "@/features/decks/components/deck-copy-fallback-dialog";
import { DeckMenuContent } from "@/features/decks/components/deck-menu-content";
import type { DeckPrintKind } from "@/features/decks/components/deck-print-dialog";
import { DeckPrintDialog } from "@/features/decks/components/deck-print-dialog";
import { DeckImageDialog } from "@/features/decks/components/deck-share-dialog";
import { useDeckOutputRuns } from "@/features/decks/hooks/use-deck-menu-runs";
import { toBuilderCardFromPublic } from "@/features/decks/lib/deck-builder-card";
import type { DeckLinkKind } from "@/features/decks/lib/deck-compare-side";
import { compareLinkParam } from "@/features/decks/lib/deck-compare-side";
import { toEncodeDeckCards } from "@/features/decks/lib/deck-encode-input";
import type { DeckMenuAction } from "@/features/decks/lib/deck-menu-model";
import { deckMenuModel } from "@/features/decks/lib/deck-menu-model";
import { shareImageVersion } from "@/lib/share-image";
import { shareLinkUrl } from "@/lib/share-links";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

interface PublicDeckActionsMenuProps {
  deckId: string;
  deckName: string;
  shareToken: string;
  linkKind: DeckLinkKind;
  updatedAt: string;
  cards: PublicDeckCardResponse[];
  inTopBar?: boolean;
}

type PublicDialog = "link" | "image" | DeckPrintKind;

const DIALOG_OF: Partial<Record<DeckMenuAction, PublicDialog>> = {
  shareLink: "link",
  saveImage: "image",
  printProxies: "proxies",
  printRegistration: "registration",
};

function publicDeckUrl(linkKind: DeckLinkKind, token: string): string {
  if (linkKind === "meta") {
    return `${getSiteUrl()}/meta/decks/${token}`;
  }
  return shareLinkUrl("deck", { shareToken: token, isPublic: true }) ?? "";
}

export function PublicDeckActionsMenu({
  deckId,
  deckName,
  shareToken,
  linkKind,
  updatedAt,
  cards,
  inTopBar = false,
}: PublicDeckActionsMenuProps) {
  const [dialog, setDialog] = useState<PublicDialog | null>(null);
  const builderCards = cards.map((card) => toBuilderCardFromPublic(card));
  const source = () => ({ cards: toEncodeDeckCards(builderCards) });
  const outputs = useDeckOutputRuns(source);
  const cardCount = cards.reduce((sum, card) => sum + card.quantity, 0);
  const model = deckMenuModel({
    context: "public",
    server: false,
    cardCount,
    archived: false,
    isVariant: false,
    isPrimary: false,
    hasOtherFormats: false,
  });
  const openChange = (target: PublicDialog) => (open: boolean) => setDialog(open ? target : null);

  const onAction = (action: DeckMenuAction) => {
    const target = DIALOG_OF[action];
    if (target) {
      setDialog(target);
      return;
    }
    outputs.run[action]?.();
  };

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
          <DeckMenuContent
            model={model}
            context="public"
            deck={{ isPinned: false, isDraft: false, archived: false }}
            compareFrom={compareLinkParam(linkKind, shareToken)}
            formats={[]}
            onAction={onAction}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "link" && (
        <ShareDialog
          open
          onOpenChange={openChange("link")}
          title={m.decks_dialog_share_title()}
          noun="deck"
          link={{
            url: publicDeckUrl(linkKind, shareToken),
            label: m.decks_dialog_share_link_label(),
          }}
          qrFilename={{ base: deckName, fallback: "deck", id: deckId }}
        />
      )}

      {dialog === "image" && (
        <DeckImageDialog
          open
          onOpenChange={openChange("image")}
          deckId={deckId}
          deckName={deckName}
          cards={builderCards}
          publicSource={{ shareToken, imageVersion: shareImageVersion(updatedAt) }}
        />
      )}

      {(dialog === "proxies" || dialog === "registration") && (
        <DeckPrintDialog
          open
          kind={dialog}
          onOpenChange={openChange(dialog)}
          deckId={deckId}
          deckName={deckName}
          cards={builderCards}
        />
      )}

      <DeckCopyFallbackDialog fallback={outputs.fallback} onClose={() => outputs.closeFallback()} />
    </>
  );
}
