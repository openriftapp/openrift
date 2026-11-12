import { enumLabel } from "@openrift/shared/enum-label";
import { straightenApostrophes } from "@openrift/shared/strings";
import type { ListKind } from "@openrift/shared/types/api/list";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDownLeftIcon, HeartIcon, LockIcon, ShoppingCartIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { CopyTextButton } from "@/components/copy-text-button";
import { MarketplaceIcon } from "@/components/marketplace-icon";
import { MarketplaceLink } from "@/components/marketplace-link";
import { MarketplacePasteLink } from "@/components/marketplace-paste-link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pressable } from "@/components/ui/pressable";
import { SectionHeading } from "@/components/ui/section-heading";
import { textLinkVariants } from "@/components/ui/text-link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { CardDetailOverlay } from "@/features/cards/components/card-detail-overlay";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
import { useMarketplaceLinks } from "@/features/cards/hooks/use-marketplace-links";
import { MARKETPLACE_META } from "@/features/cards/lib/marketplace-meta";
import { distinctPrintingCode } from "@/features/cards/lib/printing-search-link";
import { lockedReasonText } from "@/features/decks/hooks/use-deck-ownership";
import {
  missingCardsToHandoffItems,
  missingCardsToListEntries,
} from "@/features/decks/lib/deck-missing-export";
import type { CardOwnership } from "@/features/decks/lib/deck-ownership-types";
import { AddToWishlistDialog } from "@/features/lists/components/add-to-wishlist-dialog";
import { CreateListDialog } from "@/features/lists/components/create-list-dialog";
import { useZoneOrder } from "@/hooks/use-enums";
import { formatterForMarketplace } from "@/lib/format";
import {
  marketplaceCartLabel,
  marketplaceHandoff,
  marketplaceUnlistedNote,
} from "@/lib/marketplace-handoff";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

interface DeckMissingCardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingCards: CardOwnership[];
  totalMissingValue: number | undefined;
  marketplace: Marketplace;
  /** "prices" drops the ownership framing and shows a price breakdown instead. */
  mode?: "missing" | "prices";
  /** Pre-fills the wishlist name; shows the "Create wishlist" button when set (mode "missing"). */
  deckName?: string;
}

function CardIdentity({
  card,
  printing,
  onOpenDetail,
}: {
  card: CardOwnership;
  printing: CardOwnership["displayPrinting"];
  onOpenDetail: (printingId: string) => void;
}) {
  const label = (
    <>
      <span className="text-muted-foreground font-mono">
        {printing ? distinctPrintingCode(printing) : "--"}
      </span>{" "}
      {card.displayName}
    </>
  );

  if (printing === undefined) {
    return <span>{label}</span>;
  }

  return (
    <Pressable
      onClick={() => onOpenDetail(printing.sideKey)}
      className="group inline-flex items-center gap-1.5 rounded-sm"
    >
      <RarityIcon rarity={printing.rarity} labelled className="size-3.5" />
      <span className={cn(textLinkVariants({ variant: "muted" }), "group-hover:text-foreground")}>
        {label}
      </span>
    </Pressable>
  );
}

// Incoming copies aren't locked and aren't the viewer's yet: they explain
// part of the shortfall without reducing it.
function incomingTooltipText(card: CardOwnership): string {
  return m.decks_overview_incoming({ count: card.incoming });
}

// A suspending read inside this dialog, mounted while closed, would else be
// caught by the page's own boundary and hide the whole page mid-edit.
export function DeckMissingCardsDialog(props: DeckMissingCardsDialogProps) {
  return (
    <Suspense fallback={null}>
      <MissingCardsDialogBody {...props} />
    </Suspense>
  );
}

function MissingCardsDialogBody({
  open,
  onOpenChange,
  missingCards,
  totalMissingValue,
  marketplace,
  mode = "missing",
  deckName,
}: DeckMissingCardsDialogProps) {
  const [wishlistPickerOpen, setWishlistPickerOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  // The raw setter is handed to the overlay: it needs a stable identity for its history entry.
  const [detailPrintingId, setDetailPrintingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const fmt = formatterForMarketplace(marketplace);
  const meta = MARKETPLACE_META[marketplace];
  const showImages = useDisplayStore((s) => s.showImages);
  const { zoneOrder, zoneLabels } = useZoneOrder();
  const zoneRank = new Map<string, number>(zoneOrder.map((zone, index) => [zone, index]));
  const rankOf = (zone: string) => zoneRank.get(zone) ?? zoneOrder.length;

  const sorted = missingCards.toSorted((a, b) => {
    const zoneCmp = rankOf(a.zone) - rankOf(b.zone);
    if (zoneCmp !== 0) {
      return zoneCmp;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  const groupedByZone = [...Map.groupBy(sorted, (card) => card.zone).entries()];

  // Rows deep-link to the completion printing (cheapest one that fills the
  // shortfall), not the deck's displayed pin.
  const rowPrintings = sorted.flatMap((card) => {
    const printing = card.cheapestPrinting ?? card.displayPrinting;
    return printing ? [printing] : [];
  });
  const rowPrintingIds = rowPrintings.map((printing) => printing.id);

  const { data: marketplaceInfo } = useMarketplaceLinks(open ? rowPrintingIds : []);

  const linkFor = (card: CardOwnership, printing: CardOwnership["displayPrinting"]): string => {
    const info = printing ? marketplaceInfo?.links[printing.id]?.[marketplace] : undefined;
    if (printing && info?.available && info.productId !== null) {
      return meta.productUrl(info.productId, printing.language);
    }
    return meta.searchUrl(card.cardName);
  };

  const listText = () =>
    sorted
      .map((card) => {
        const printing = card.cheapestPrinting ?? card.displayPrinting;
        const price = card.cheapestPrice ?? card.displayPrice;
        const code = printing && distinctPrintingCode(printing);
        const cardName = straightenApostrophes(card.cardName);
        const namePart = code ? `${code} ${cardName}` : cardName;
        const priceText = price === undefined ? "" : ` - ${fmt(price * card.shortfall)}`;
        return `${card.shortfall}x ${namePart}${priceText}`;
      })
      .join("\n");

  const totalMissing = sorted.reduce((sum, card) => sum + card.shortfall, 0);

  const handoff = marketplaceHandoff(
    marketplace,
    missingCardsToHandoffItems(sorted),
    (printingId) => marketplaceInfo?.links[printingId]?.[marketplace].productId,
  );

  const buildWishlistEntries = (kind: ListKind) => missingCardsToListEntries(sorted, kind);

  const showWishlistButton = mode === "missing" && deckName !== undefined && sorted.length > 0;

  const handleSearchAndClose = (query: string) => {
    setDetailPrintingId(null);
    onOpenChange(false);
    void navigate({ to: "/cards", search: { q: query } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "prices"
              ? m.decks_overview_missing_title_prices({ count: totalMissing })
              : m.decks_overview_missing_title({ count: totalMissing })}
          </DialogTitle>
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <MarketplaceIcon marketplace={marketplace} />
            {m.decks_overview_prices_from({ marketplace: meta.label })}
          </div>
        </DialogHeader>

        <div className="max-h-80 [scrollbar-gutter:stable] overflow-y-auto text-sm">
          {groupedByZone.map(([zone, cards]) => (
            <div key={zone} className="pt-3 first:pt-0">
              <SectionHeading as="h3" className="px-2 pb-1">
                {enumLabel(zoneLabels, zone)}
              </SectionHeading>
              {cards.map((card) => {
                const printing = card.cheapestPrinting ?? card.displayPrinting;
                const price = card.cheapestPrice ?? card.displayPrice;
                return (
                  <div
                    key={`${card.cardId}:${card.zone}`}
                    className="hover:bg-muted/50 flex items-center gap-2 rounded-md py-1.5 pr-3 pl-2 sm:gap-3"
                  >
                    <CardArtThumb
                      shape="strip"
                      imageId={printing?.imageId}
                      landscape={printing?.landscape}
                      rarity={printing?.rarity}
                      loading="lazy"
                      className="h-9 sm:hidden"
                    />
                    {/* sm:contents dissolves this wrapper so the cart stays a direct
                        child of the row and centers on the full row height. */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                      <div className="flex min-w-0 items-center gap-1.5 sm:flex-1">
                        <CardIdentity
                          card={card}
                          printing={printing}
                          onOpenDetail={setDetailPrintingId}
                        />
                        {card.locked > 0 && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span className="text-muted-foreground inline-flex items-center" />
                              }
                            >
                              <LockIcon className="size-3" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-56 text-xs">
                              {lockedReasonText(card)}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {card.incoming > 0 && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span className="text-muted-foreground inline-flex items-center" />
                              }
                            >
                              <ArrowDownLeftIcon className="size-3" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-56 text-xs">
                              {incomingTooltipText(card)}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="whitespace-nowrap sm:text-right">
                        {price === undefined ? (
                          <span className="text-muted-foreground">{card.shortfall} × --</span>
                        ) : card.shortfall === 1 ? (
                          <span className="font-medium">{fmt(price)}</span>
                        ) : (
                          <>
                            <span className="text-muted-foreground">
                              {card.shortfall} × {fmt(price)} ={" "}
                            </span>
                            <span className="font-medium">{fmt(price * card.shortfall)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <MarketplaceLink
                      marketplace={marketplace}
                      href={linkFor(card, printing)}
                      title={m.decks_overview_buy_on({ marketplace: meta.label })}
                      aria-label={m.decks_overview_buy_card_on({
                        card: card.displayName,
                        marketplace: meta.label,
                      })}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-7 shrink-0 items-center justify-center rounded-md"
                    >
                      <ShoppingCartIcon className="size-4" />
                    </MarketplaceLink>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {totalMissingValue !== undefined && (
          <div className="text-muted-foreground flex items-center justify-between px-2 pt-4 text-sm">
            <span>{m.decks_overview_missing_total()}</span>
            <span className="text-foreground font-medium">{fmt(totalMissingValue)}</span>
          </div>
        )}

        {handoff.kind === "cart" && marketplaceInfo !== undefined && handoff.unlisted > 0 && (
          <p className="text-muted-foreground px-2 text-sm">
            {marketplaceUnlistedNote(handoff.marketplace, handoff.unlisted)}
          </p>
        )}

        <DialogFooter>
          {showWishlistButton && (
            <Button variant="outline" size="sm" onClick={() => setWishlistPickerOpen(true)}>
              <HeartIcon className="size-3.5" />
              {m.decks_overview_missing_add_wishlist()}
            </Button>
          )}
          {handoff.kind === "paste" ? (
            <>
              <MarketplacePasteLink marketplace={handoff.marketplace} />
              <CopyTextButton
                label={m.decks_overview_missing_copy_for({ marketplace: meta.label })}
                value={handoff.text}
                size="sm"
              />
            </>
          ) : marketplaceInfo === undefined || handoff.sent === 0 ? (
            <Button variant="outline" size="sm" disabled>
              <ShoppingCartIcon className="size-3.5" />
              {marketplaceCartLabel(handoff.marketplace, totalMissing)}
            </Button>
          ) : (
            <MarketplaceLink
              marketplace={handoff.marketplace}
              href={handoff.href}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ShoppingCartIcon className="size-3.5" />
              {marketplaceCartLabel(handoff.marketplace, handoff.sent)}
            </MarketplaceLink>
          )}
          <CopyTextButton
            label={m.decks_overview_missing_copy_list()}
            getText={listText}
            size="sm"
          />
        </DialogFooter>
      </DialogContent>
      <CardDetailOverlay
        printingIds={rowPrintings.map((printing) => printing.sideKey)}
        openPrintingId={detailPrintingId}
        onOpenPrintingIdChange={setDetailPrintingId}
        showImages={showImages}
        onSearchAndClose={handleSearchAndClose}
        // Must differ from the page's own store-driven overlay's history key.
        historyKey="missingCardDetail"
        allowCollectionEdits={mode === "missing"}
      />
      {/* Mounted only while open: AddToWishlistDialog suspends on a wishlists
          query in its body, and this dialog stays mounted while closed. */}
      {showWishlistButton && wishlistPickerOpen && (
        <AddToWishlistDialog
          open={wishlistPickerOpen}
          onOpenChange={setWishlistPickerOpen}
          entriesFor={buildWishlistEntries}
          onCreateNew={() => setWishlistOpen(true)}
          onAdded={() => onOpenChange(false)}
        />
      )}
      {showWishlistButton && (
        <CreateListDialog
          intent="wish"
          open={wishlistOpen}
          onOpenChange={setWishlistOpen}
          defaultName={m.decks_overview_missing_list_name({ deck: deckName })}
          initialEntries={buildWishlistEntries}
          title={m.decks_overview_missing_list_title({ deck: deckName })}
          description={m.decks_overview_missing_list_description()}
          kindHints={{
            card: m.decks_overview_missing_list_hint_card(),
            printing: m.decks_overview_missing_list_hint_printing(),
          }}
          onCreated={(listId) => {
            onOpenChange(false);
            void navigate({
              to: "/collections/lists/$listId",
              params: { listId },
            });
          }}
        />
      )}
    </Dialog>
  );
}
