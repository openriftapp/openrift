import type { ListKind } from "@openrift/shared/types/api/list";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { straightenApostrophes } from "@openrift/shared/utils";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDownLeftIcon, HeartIcon, LockIcon, ShoppingCartIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { CardmarketWantsLink } from "@/components/cardmarket-wants-link";
import { CopyTextButton } from "@/components/copy-text-button";
import { MarketplaceLink } from "@/components/marketplace-link";
import { Button } from "@/components/ui/button";
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
import { useMarketplaceInfo } from "@/features/cards/hooks/use-marketplace-info";
import { MARKETPLACE_META } from "@/features/cards/lib/marketplace-meta";
import {
  missingCardsToListEntries,
  missingCardsToWants,
} from "@/features/decks/lib/deck-missing-export";
import type { CardOwnership } from "@/features/decks/lib/deck-ownership-types";
import { zoneLabel } from "@/features/decks/lib/deck-zone-labels";
import { AddToWishlistDialog } from "@/features/lists/components/add-to-wishlist-dialog";
import { CreateListDialog } from "@/features/lists/components/create-list-dialog";
import { useEnumOrders } from "@/hooks/use-enums";
import { formatCardmarketWants } from "@/lib/export-text";
import { formatterForMarketplace } from "@/lib/format";
import { getFilterIconPath } from "@/lib/icons";
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
  rarityLabel,
  onOpenDetail,
}: {
  card: CardOwnership;
  printing: CardOwnership["displayPrinting"];
  rarityLabel: string | undefined;
  onOpenDetail: (printingId: string) => void;
}) {
  const content = (
    <>
      {printing && (
        <img
          src={getFilterIconPath("rarities", printing.rarity)}
          alt={rarityLabel}
          title={rarityLabel}
          width={28}
          height={28}
          className="size-3.5 shrink-0"
        />
      )}
      <span className="text-muted-foreground font-mono">{printing?.shortCode ?? "--"}</span>
      <span>{card.displayName}</span>
    </>
  );

  if (printing === undefined) {
    return <span className="inline-flex items-center gap-1.5">{content}</span>;
  }

  return (
    <Pressable
      onClick={() => onOpenDetail(printing.id)}
      className={cn(
        textLinkVariants({ variant: "muted" }),
        "inline-flex items-center gap-1.5 rounded-sm",
      )}
    >
      {content}
    </Pressable>
  );
}

// Reasons are joined as alternatives, not counted per-reason: the per-reason
// counts aren't zone-capped the way `locked` is, so they can't be shown beside it.
function lockedTooltipText(card: CardOwnership): string {
  const reasons: string[] = [];
  if (card.lockedLoaned > 0) {
    reasons.push(m.decks_overview_locked_reason_loan());
  }
  if (card.lockedReserved > 0) {
    reasons.push(m.decks_overview_locked_reason_trade());
  }
  if (card.lockedExcluded > 0) {
    reasons.push(m.decks_overview_locked_reason_excluded());
  }

  if (reasons.length <= 1) {
    const reason = reasons[0] ?? m.decks_overview_locked_reason_generic();
    return m.decks_overview_locked({ count: card.locked, reason });
  }
  const last = reasons.at(-1) ?? "";
  const rest = reasons.slice(0, -1).join(", ");
  return m.decks_overview_locked_multi({ count: card.locked, rest, last });
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
  const { labels: enumLabels } = useEnumOrders();
  const showImages = useDisplayStore((s) => s.showImages);

  const sorted = missingCards.toSorted((a, b) => {
    const zoneCmp = zoneLabel(a.zone).localeCompare(zoneLabel(b.zone));
    if (zoneCmp !== 0) {
      return zoneCmp;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  const groupedByZone = [...Map.groupBy(sorted, (card) => card.zone).entries()];

  // Rows deep-link to the completion printing (cheapest one that fills the
  // shortfall), not the deck's displayed pin.
  const rowPrintingIds = sorted.flatMap((card) => {
    const printing = card.cheapestPrinting ?? card.displayPrinting;
    return printing ? [printing.id] : [];
  });

  const { data: marketplaceInfo } = useMarketplaceInfo(open ? rowPrintingIds : []);

  const linkFor = (card: CardOwnership, printing: CardOwnership["displayPrinting"]): string => {
    const info = printing ? marketplaceInfo?.infos[printing.id]?.[marketplace] : undefined;
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
        const code = printing?.shortCode;
        const cardName = straightenApostrophes(card.cardName);
        const namePart = code ? `${code} ${cardName}` : cardName;
        const priceText = price === undefined ? "" : ` - ${fmt(price * card.shortfall)}`;
        return `${card.shortfall}x ${namePart}${priceText}`;
      })
      .join("\n");

  // Cardmarket's wants import matches by card name; short codes or prices break it.
  const cardmarketText = () => formatCardmarketWants(missingCardsToWants(sorted));

  const totalMissing = sorted.reduce((sum, card) => sum + card.shortfall, 0);

  const buildWishlistEntries = (kind: ListKind) => missingCardsToListEntries(sorted, kind);

  const showWishlistButton = mode === "missing" && deckName !== undefined && sorted.length > 0;

  const handleSearchAndClose = (query: string) => {
    setDetailPrintingId(null);
    onOpenChange(false);
    void navigate({ to: "/cards", search: { search: query } });
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
            <img src={meta.icon} alt="" className="h-3 invert dark:invert-0" />
            {m.decks_overview_prices_from({ marketplace: meta.label })}
          </div>
        </DialogHeader>

        <div className="max-h-80 [scrollbar-gutter:stable] overflow-y-auto text-sm">
          {groupedByZone.map(([zone, cards]) => (
            <div key={zone} className="pt-3 first:pt-0">
              <SectionHeading as="h3" className="px-2 pb-1">
                {zoneLabel(zone)}
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
                          rarityLabel={printing ? enumLabels.rarities[printing.rarity] : undefined}
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
                              {lockedTooltipText(card)}
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

        <DialogFooter>
          {showWishlistButton && (
            <Button variant="outline" size="sm" onClick={() => setWishlistPickerOpen(true)}>
              <HeartIcon className="size-3.5" />
              {m.decks_overview_missing_add_wishlist()}
            </Button>
          )}
          <CardmarketWantsLink />
          <CopyTextButton
            label={m.decks_overview_missing_copy_cardmarket()}
            getText={cardmarketText}
            size="sm"
          />
          <CopyTextButton
            label={m.decks_overview_missing_copy_list()}
            getText={listText}
            size="sm"
          />
        </DialogFooter>
      </DialogContent>
      <CardDetailOverlay
        printingIds={rowPrintingIds}
        openPrintingId={detailPrintingId}
        onOpenPrintingIdChange={setDetailPrintingId}
        showImages={showImages}
        onSearchAndClose={handleSearchAndClose}
        // Must differ from the page's own store-driven overlay's history key.
        historyKey="missingCardDetail"
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
