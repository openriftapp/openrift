import { useDraggable } from "@dnd-kit/core";
import { legendDisplayName } from "@openrift/shared/card-name";
import type { DeckZone } from "@openrift/shared/types/enums";
import { ImageOffIcon, LayersIcon, MinusIcon, PinIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CountPill } from "@/components/ui/count-pill";
import { InlineCountStepper } from "@/components/ui/inline-count-stepper";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CardPriceChip } from "@/features/cards/components/card-price-chip";
import { CardStrip, StripIconButton } from "@/features/cards/components/card-strip";
import { AFTER_BORDER, BanRibbon } from "@/features/cards/components/card-thumbnail";
import { useCards } from "@/features/cards/hooks/use-cards";
import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import type { CardOpenTarget, HoverHandler } from "@/features/cards/lib/card-row-interactions";
import { CardQuantityChip } from "@/features/decks/components/card-quantity-chip";
import { DeckCardPageLink } from "@/features/decks/components/deck-card-page-link";
import { DeckCardPrintingMenu } from "@/features/decks/components/deck-card-printing-menu";
import { LabeledOwnershipBand } from "@/features/decks/components/ownership-band";
import { useDeckBuilderActions } from "@/features/decks/hooks/use-deck-builder";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { cardInteractiveProps, deckCardDragData } from "@/features/decks/lib/deck-card-interaction";
import { DRAG_SOURCE_ZONES } from "@/features/decks/lib/deck-dnd-data";
import { STEPPER_ZONES } from "@/features/decks/lib/deck-overview-derive";
import type { OwnershipBandSegments } from "@/features/decks/lib/deck-ownership-band";
import { copyBandSegments } from "@/features/decks/lib/deck-ownership-band";
import {
  LANDSCAPE_THUMB_CLASS,
  LANDSCAPE_THUMB_STYLE,
  PORTRAIT_THUMB_CLASS,
  PORTRAIT_THUMB_STYLE,
} from "@/features/decks/lib/deck-thumb-metrics";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useSelectionStore } from "@/stores/selection-store";

/**
 * Its own component so the builder-action hooks never mount on read-only
 * surfaces (the share page renders no controls at all).
 */
function ThumbEditControls({
  deckId,
  card,
  zone,
  addRoom,
  perCopy,
  alwaysVisible,
}: {
  deckId: string;
  card: DeckBuilderCard;
  zone: DeckZone;
  addRoom: number;
  perCopy: boolean;
  alwaysVisible: boolean;
}) {
  const { addCard, removeCard, setQuantity } = useDeckBuilderActions(deckId);
  const cardName = legendDisplayName({
    name: card.cardName,
    types: card.cardTypes,
    tags: card.tags,
  });
  // Per-copy thumbs have no count of their own to step, and the one-card zones
  // (legend, champion, battlefield) can only be emptied.
  const showStepper = !perCopy && STEPPER_ZONES.has(zone);
  const reveal = alwaysVisible ? "flex" : "hidden group-hover/thumb:flex";

  // Every handler stops propagation: the thumb itself opens the card detail on
  // click, and dnd-kit's activation distance handles the drag case.
  const decrement = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (event.shiftKey) {
      setQuantity(card.cardId, zone, 0, card.preferredPrintingId);
      return;
    }
    removeCard(card.cardId, zone, card.preferredPrintingId);
  };

  const increment = (event: React.MouseEvent) => {
    event.stopPropagation();
    // Shift fills the entry up to whatever the caps allow; an uncapped zone has
    // no "max" to fill to, so it stays one copy per click.
    const bulk = event.shiftKey && Number.isFinite(addRoom) && addRoom > 1;
    addCard(card, zone, bulk ? addRoom : 1);
  };

  const remove = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (perCopy) {
      removeCard(card.cardId, zone, card.preferredPrintingId);
      return;
    }
    setQuantity(card.cardId, zone, 0, card.preferredPrintingId);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn(
                "bg-background/80 hover:bg-background absolute top-1 right-1 z-40 size-5 rounded-md",
                reveal,
              )}
              aria-label={
                perCopy
                  ? m.decks_editor_remove_one_copy({ card: cardName })
                  : m.decks_editor_remove_card({ card: cardName })
              }
              onClick={remove}
            />
          }
        >
          <XIcon className="size-3" />
        </TooltipTrigger>
        <TooltipContent>
          {perCopy ? m.decks_editor_remove_this_copy() : m.decks_editor_remove_from_deck()}
        </TooltipContent>
      </Tooltip>
      {showStepper && (
        <InlineCountStepper
          size="xs"
          className={cn(
            "bg-background/90 text-foreground absolute right-1 bottom-1 gap-0.5 rounded-full p-0.5",
            reveal,
          )}
          count={card.quantity}
          decrementLabel={m.decks_editor_remove_one_copy({ card: cardName })}
          incrementLabel={m.decks_editor_add_one_copy({ card: cardName })}
          onDecrement={decrement}
          onIncrement={addRoom > 0 ? increment : undefined}
          decrementTooltip={m.decks_editor_shift_remove_all()}
          incrementTooltip={addRoom > 0 ? m.decks_editor_shift_add_max() : undefined}
        />
      )}
    </>
  );
}

function ThumbStepStrip({
  deckId,
  card,
  zone,
  addRoom,
  perCopy,
}: {
  deckId: string;
  card: DeckBuilderCard;
  zone: DeckZone;
  addRoom: number;
  perCopy: boolean;
}) {
  const { addCard, removeCard } = useDeckBuilderActions(deckId);
  const cardName = legendDisplayName({
    name: card.cardName,
    types: card.cardTypes,
    tags: card.tags,
  });
  const canAdd = !perCopy && addRoom > 0;
  return (
    <CardStrip
      left={
        <StripIconButton
          className="text-muted-foreground"
          aria-label={m.decks_editor_remove_one_copy({ card: cardName })}
          onClick={() => removeCard(card.cardId, zone, card.preferredPrintingId)}
        >
          <MinusIcon />
        </StripIconButton>
      }
      center={
        perCopy ? undefined : (
          <CountPill
            variant="primary"
            title={m.decks_editor_in_deck_count({ count: card.quantity })}
          >
            <LayersIcon className="size-3" aria-hidden />
            <span>{card.quantity}</span>
            <span className="sr-only">{m.decks_editor_in_deck()}</span>
          </CountPill>
        )
      }
      right={
        <StripIconButton
          className={canAdd ? "text-muted-foreground" : "text-muted-foreground/30"}
          disabled={!canAdd}
          aria-label={m.decks_editor_add_one_copy({ card: cardName })}
          onClick={() => addCard(card, zone, 1)}
        >
          <PlusIcon />
        </StripIconButton>
      }
    />
  );
}

const EXACT_COPY = { exact: 1, other: 0, borrowed: 0, locked: 0, missing: 0 };

export function ZoneThumb({
  deckId,
  card,
  band,
  priceText,
  caption,
  addRoom,
  hoverPrintingId,
  copyIndex,
  showsCopyPrinting = false,
  dimmed,
  zone,
  thumbnail,
  isLandscape,
  onHoverCard,
  readOnly,
  onCardClick,
}: {
  deckId: string;
  card: DeckBuilderCard;
  band?: OwnershipBandSegments;
  priceText?: string;
  caption?: string;
  addRoom?: number;
  hoverPrintingId?: string | null;
  copyIndex?: number | null;
  showsCopyPrinting?: boolean;
  dimmed?: boolean;
  zone: DeckZone;
  thumbnail?: string;
  isLandscape: boolean;
  onHoverCard?: HoverHandler;
  readOnly?: boolean;
  onCardClick?: (card: CardOpenTarget) => void;
}) {
  const isMobile = useIsMobile();
  const coarsePointer = useCoarsePointer();
  const catalogCard = useCards().cardsById[card.cardId];
  const controlsAlwaysVisible = isMobile || coarsePointer;
  const stepAbove = !readOnly && isMobile && STEPPER_ZONES.has(zone);
  const enableDrag = !readOnly && !isMobile && DRAG_SOURCE_ZONES.has(zone);
  const perCopy = copyIndex !== null && copyIndex !== undefined;
  const editable = !readOnly;
  const displayName = legendDisplayName({
    name: card.cardName,
    types: card.cardTypes,
    tags: card.tags,
  });
  // Top-left, to clear the ownership band along the bottom edge and the
  // ×N badge at bottom-right.
  const hasCustomPrinting = card.preferredPrintingId !== null;
  // Match on (zone, cardId) so a card in multiple zones only lights up at
  // the instance the user actually clicked.
  const isSelected = useSelectionStore(
    (state) => state.selectedZone === zone && state.selectedCard?.cardId === card.cardId,
  );

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `overview-thumb-${card.cardId}-${zone}-${card.preferredPrintingId ?? "default"}-${copyIndex ?? "stack"}`,
    data: deckCardDragData(card, zone, displayName),
    disabled: !enableDrag,
  });

  // Keyed by URL so a changed printing pick retries fresh.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showFallback = !thumbnail || thumbnail === failedUrl;

  const interactiveProps = cardInteractiveProps(card, onCardClick);

  const thumbBody = (
    // @container: the badge below is sized in cqw, tracking the thumb at any column count.
    <div
      ref={enableDrag ? setNodeRef : undefined}
      style={{
        ...(isLandscape ? LANDSCAPE_THUMB_STYLE : PORTRAIT_THUMB_STYLE),
        borderRadius: CARD_BORDER_RADIUS,
      }}
      className={cn(
        "group/thumb @container relative shrink-0",
        // The fallback name card draws its own dashed outline instead.
        !showFallback && AFTER_BORDER,
        isLandscape ? LANDSCAPE_THUMB_CLASS : PORTRAIT_THUMB_CLASS,
        enableDrag && "cursor-grab active:cursor-grabbing",
        onCardClick && !enableDrag && "cursor-pointer",
        isDragging && card.quantity === 1 && "opacity-40",
        isSelected && "ring-primary ring-offset-background ring-2 ring-offset-2",
        dimmed && "opacity-25 transition-opacity",
      )}
      onMouseEnter={() => onHoverCard?.(card.cardId, hoverPrintingId ?? card.preferredPrintingId)}
      onMouseLeave={() => onHoverCard?.(null)}
      {...interactiveProps}
      {...(enableDrag ? listeners : {})}
      {...(enableDrag ? attributes : {})}
    >
      <DeckCardPageLink
        cardId={card.cardId}
        printingId={hoverPrintingId ?? card.preferredPrintingId}
        className="block h-full w-full rounded-[inherit]"
      >
        {showFallback ? (
          <div className="border-muted-foreground/25 bg-muted/30 flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[inherit] border border-dashed p-2 text-center">
            <ImageOffIcon aria-hidden="true" className="text-muted-foreground/70 size-5 shrink-0" />
            <span className="text-muted-foreground line-clamp-3 text-xs">{displayName}</span>
          </div>
        ) : (
          <img
            src={thumbnail}
            alt={displayName}
            className="h-full w-full rounded-[inherit] object-cover shadow-sm"
            draggable={false}
            onError={() => setFailedUrl(thumbnail)}
          />
        )}
      </DeckCardPageLink>
      {catalogCard && <BanRibbon bans={catalogCard.bans} upcomingBans={catalogCard.upcomingBans} />}
      {hasCustomPrinting && (
        <span
          title={m.decks_editor_pinned_printing()}
          className="bg-background/70 absolute top-1 left-1 rounded-md p-0.5"
        >
          <PinIcon className="text-muted-foreground size-2.5" />
        </span>
      )}
      {card.quantity > 1 && !perCopy && (
        <CardQuantityChip
          quantity={card.quantity}
          className={cn(
            editable && (controlsAlwaysVisible ? "hidden" : "group-hover/thumb:hidden"),
          )}
        />
      )}
      {priceText && <CardPriceChip text={priceText} isLandscape={isLandscape} />}
      {editable && !stepAbove && (
        <ThumbEditControls
          deckId={deckId}
          card={card}
          zone={zone}
          addRoom={addRoom ?? 0}
          perCopy={perCopy}
          alwaysVisible={controlsAlwaysVisible}
        />
      )}
    </div>
  );

  const bandBar =
    band || caption ? (
      <>
        {caption && (
          <span className="text-muted-foreground mt-1 truncate text-center text-xs">{caption}</span>
        )}
        {band && (
          <LabeledOwnershipBand
            quantity={perCopy ? 1 : card.quantity}
            band={
              showsCopyPrinting
                ? EXACT_COPY
                : perCopy
                  ? copyBandSegments(band, copyIndex ?? 0)
                  : band
            }
            className="mt-1"
          />
        )}
      </>
    ) : null;
  const withBand = (node: React.ReactNode) =>
    bandBar ? (
      <div
        style={isLandscape ? LANDSCAPE_THUMB_STYLE : PORTRAIT_THUMB_STYLE}
        className="flex max-w-full shrink-0 flex-col"
      >
        {node}
        {bandBar}
      </div>
    ) : (
      node
    );

  if (readOnly) {
    return withBand(thumbBody);
  }

  const menuThumb = (
    <DeckCardPrintingMenu deckId={deckId} card={card}>
      {thumbBody}
    </DeckCardPrintingMenu>
  );
  if (!stepAbove) {
    return withBand(menuThumb);
  }
  return (
    <div
      style={isLandscape ? LANDSCAPE_THUMB_STYLE : PORTRAIT_THUMB_STYLE}
      className="isolate flex max-w-full shrink-0 flex-col"
    >
      <ThumbStepStrip
        deckId={deckId}
        card={card}
        zone={zone}
        addRoom={addRoom ?? 0}
        perCopy={perCopy}
      />
      {menuThumb}
      {bandBar}
    </div>
  );
}
