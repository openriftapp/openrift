import { useDraggable } from "@dnd-kit/core";
import { legendDisplayName } from "@openrift/shared/card-name";
import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import {
  AlertTriangleIcon,
  EllipsisVerticalIcon,
  HandHeartIcon,
  LockIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineCountStepper } from "@/components/ui/inline-count-stepper";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HoverHandler } from "@/features/cards/lib/card-row-interactions";
import { cardHoverProps, rowActivateProps } from "@/features/cards/lib/card-row-interactions";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { DeckCardDragData } from "@/features/decks/lib/deck-dnd-data";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useEnumOrders } from "@/hooks/use-enums";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { getDomainColor, getDomainGradientStyle } from "@/lib/domain";
import { getFilterIconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

type ControlMode = "quantity" | "remove-only" | "none";

function openRowMenu(element: Element): void {
  const rect = element.getBoundingClientRect();
  element.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.bottom,
    }),
  );
}

function handleMenuKey(event: React.KeyboardEvent<HTMLElement>): void {
  if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") {
    event.preventDefault();
    openRowMenu(event.target instanceof Element ? event.target : event.currentTarget);
  }
}

interface DeckCardRowProps {
  card: DeckBuilderCard;
  hasViolation?: boolean;
  violationMessage?: string;
  planTag?: string;
  printingLabel?: string;
  shortfall?: number;
  locked?: number;
  lockedReason?: string;
  borrowed?: number;
  borrowedReason?: string;
  dimmed?: boolean;
  controlMode?: ControlMode;
  maxQuantity?: number;
  draggable?: boolean;
  shiftHeld?: boolean;
  onIncrement?: (event: React.MouseEvent) => void;
  onDecrement?: (event: React.MouseEvent) => void;
  onRemove?: () => void;
  menuButton?: boolean;
  onClick?: () => void;
  onHover?: HoverHandler;
  onContextMenu?: (event: React.MouseEvent) => void;
}

// `/images/domains/colorless.svg` is the colorless *domain's* icon, not a
// wild/any-domain glyph; the rainbow rune is used for that instead.
const WILD_RUNE_ICON = "/images/glyphs/rune-rainbow.svg";

export function PowerDomainIcon({
  domains,
  colors,
}: {
  domains: string[];
  colors: Record<string, string>;
}) {
  const domain = domains[0] ?? WellKnown.domain.COLORLESS;
  if (domains.length === 1 && domain !== WellKnown.domain.COLORLESS) {
    const domainIcon = getFilterIconPath("domains", domain);
    return domainIcon ? <img src={domainIcon} alt="" className="inline size-3" /> : null;
  }
  // These glyphs are `currentColor` SVGs; inside an <img> that paints black
  // and vanishes in dark mode, so they're masked and tinted instead.
  const icon =
    domains.length > 1 ? WILD_RUNE_ICON : getFilterIconPath("domains", WellKnown.domain.COLORLESS);
  const c1 = getDomainColor(domain, colors);
  const c2 = getDomainColor(domains[1] ?? domain, colors);
  return (
    <span
      aria-hidden
      className="inline-block size-3"
      style={{
        background: `linear-gradient(135deg, ${c1} 30%, ${c2} 70%)`,
        mask: `url(${icon}) center / contain no-repeat`,
        WebkitMask: `url(${icon}) center / contain no-repeat`,
      }}
    />
  );
}

export function PowerPips({
  power,
  domains,
  colors,
  domainLabels,
}: {
  power: number | null;
  domains: string[];
  colors: Record<string, string>;
  domainLabels: LabelMap;
}) {
  if (power === null || power <= 0) {
    return null;
  }
  const named = domains.map((domain) => enumLabel(domainLabels, domain)).join(", ");
  const label =
    named.length > 0
      ? m.decks_editor_power_with_domains({ power, domains: named })
      : m.decks_editor_power({ power });
  return (
    <span role="img" aria-label={label} className="flex shrink-0 items-center gap-0.5">
      {Array.from({ length: power }, (_, index) => (
        <PowerDomainIcon key={index} domains={domains} colors={colors} />
      ))}
    </span>
  );
}

export function EnergyGlyph({ value }: { value: number }) {
  return (
    <span
      role="img"
      aria-label={m.decks_editor_energy({ value })}
      className="text-2xs flex size-4 shrink-0 items-center justify-center rounded-full bg-white leading-none font-bold text-[#013951]"
    >
      {value}
    </span>
  );
}

const ROW_BUTTON_HOVER = "hover:bg-foreground/20 dark:hover:bg-foreground/20";
const TOUCH_ROW_BUTTON = "bg-foreground/10 size-8 rounded-full [&_svg]:size-3.5";

export function CardControls({
  controlMode,
  cardName,
  quantity,
  countWidthClass,
  shiftHeld,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  controlMode: ControlMode;
  cardName: string;
  quantity: number;
  countWidthClass: string;
  shiftHeld?: boolean;
  onIncrement?: (event: React.MouseEvent) => void;
  onDecrement?: (event: React.MouseEvent) => void;
  onRemove?: () => void;
}) {
  const coarsePointer = useCoarsePointer();

  if (controlMode === "none") {
    return null;
  }

  if (controlMode === "remove-only") {
    // Invisible, not hidden, so the name does not shift when the button appears.
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          "shrink-0",
          ROW_BUTTON_HOVER,
          coarsePointer
            ? TOUCH_ROW_BUTTON
            : "invisible size-5 group-focus-within/card:visible group-hover/card:visible",
        )}
        onClick={(event) => {
          event.stopPropagation();
          onRemove?.();
        }}
      >
        <XIcon className="size-3" />
        <span className="sr-only">{m.decks_editor_remove_from_deck()}</span>
      </Button>
    );
  }

  return (
    <InlineCountStepper
      size="xs"
      buttonClassName={cn(ROW_BUTTON_HOVER, coarsePointer && TOUCH_ROW_BUTTON)}
      count={<span className={cn("block text-right", countWidthClass)}>{quantity}×</span>}
      decrementLabel={m.decks_editor_remove_one_copy({ card: cardName })}
      incrementLabel={m.decks_editor_add_one_copy({ card: cardName })}
      onDecrement={onDecrement}
      onIncrement={onIncrement}
      bulk={shiftHeld}
      bulkDecrementLabel={quantity > 1 ? `-${quantity}` : undefined}
      bulkIncrementLabel={<PlusIcon className="size-3" />}
      decrementTooltip={m.decks_editor_shift_remove_all()}
      incrementTooltip={m.decks_editor_shift_add_max()}
    />
  );
}

export function DeckCardRow({
  card,
  hasViolation,
  violationMessage,
  planTag,
  printingLabel,
  shortfall,
  locked,
  lockedReason,
  borrowed,
  borrowedReason,
  dimmed,
  controlMode = "quantity",
  maxQuantity,
  draggable,
  shiftHeld,
  onIncrement,
  onDecrement,
  onRemove,
  menuButton,
  onClick,
  onHover,
  onContextMenu,
}: DeckCardRowProps) {
  const coarsePointer = useCoarsePointer();
  const isMobile = useIsMobile();
  const domainColors = useDomainColors();
  const { labels } = useEnumOrders();
  const enableDrag = draggable && !isMobile;

  const cardName = legendDisplayName({
    name: card.cardName,
    types: card.cardTypes,
    tags: card.tags,
  });

  const dragData: DeckCardDragData = {
    type: "deck-card",
    cardId: card.cardId,
    cardName,
    fromZone: card.zone as DeckZone,
    quantity: card.quantity,
    preferredPrintingId: card.preferredPrintingId,
  };

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `deck-card-${card.cardId}-${card.zone}-${card.preferredPrintingId ?? "default"}`,
    data: dragData,
    disabled: !enableDrag,
  });

  const displayQuantity = isDragging && card.quantity > 1 ? card.quantity - 1 : card.quantity;

  const countDigits = String(maxQuantity ?? card.quantity).length;
  const countWidthClass = countDigits >= 3 ? "w-9" : countDigits === 2 ? "w-7" : "w-4";

  const domainTint = getDomainGradientStyle(card.domains, "40", domainColors);

  const baseClass = cn(
    "group/card flex min-h-10 items-center gap-1.5 rounded-md px-1 py-0.5 text-sm sm:min-h-0 sm:py-1",
    hasViolation && "bg-destructive/10",
    dimmed && "opacity-50",
    isDragging && card.quantity === 1 && "opacity-40",
  );

  const cardControls = (
    <CardControls
      controlMode={controlMode}
      cardName={cardName}
      quantity={displayQuantity}
      countWidthClass={countWidthClass}
      shiftHeld={shiftHeld}
      onIncrement={onIncrement}
      onDecrement={onDecrement}
      onRemove={onRemove}
    />
  );

  const content = (
    <>
      {hasViolation && (
        <Tooltip>
          <TooltipTrigger className="shrink-0">
            <AlertTriangleIcon className="text-destructive size-3.5" />
          </TooltipTrigger>
          {violationMessage && <TooltipContent>{violationMessage}</TooltipContent>}
        </Tooltip>
      )}

      {cardControls}

      <span className="min-w-0 flex-1 truncate text-left">
        {cardName}
        {printingLabel && <span className="text-muted-foreground"> · {printingLabel}</span>}
      </span>

      {planTag && <Badge variant="neutral">{planTag}</Badge>}

      <PowerPips
        power={card.power}
        domains={card.domains}
        colors={domainColors}
        domainLabels={labels.domains}
      />

      {card.energy !== null && <EnergyGlyph value={card.energy} />}

      {shortfall !== undefined && shortfall > 0 && (
        <Tooltip>
          <TooltipTrigger className="shrink-0">
            <span className="text-2xs text-warning tabular-nums">
              {card.quantity - shortfall}/{card.quantity}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {m.decks_editor_you_have({
              owned: card.quantity - shortfall,
              total: card.quantity,
            })}
          </TooltipContent>
        </Tooltip>
      )}

      {locked !== undefined && locked > 0 && (
        <Tooltip>
          <TooltipTrigger className="text-muted-foreground flex shrink-0 items-center gap-0.5">
            <LockIcon className="size-3" />
            <span className="text-2xs tabular-nums">{locked}</span>
          </TooltipTrigger>
          <TooltipContent>{lockedReason}</TooltipContent>
        </Tooltip>
      )}

      {borrowed !== undefined && borrowed > 0 && (
        <Tooltip>
          <TooltipTrigger className="text-muted-foreground flex shrink-0 items-center gap-0.5">
            <HandHeartIcon className="size-3" />
            <span className="text-2xs tabular-nums">{borrowed}</span>
          </TooltipTrigger>
          <TooltipContent>{borrowedReason}</TooltipContent>
        </Tooltip>
      )}

      {menuButton && (
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "shrink-0",
            coarsePointer
              ? "text-muted-foreground size-8 [&_svg]:size-4"
              : "hidden size-5 group-focus-within/card:inline-flex group-hover/card:inline-flex",
          )}
          aria-label={m.decks_workbench_row_menu({ card: cardName })}
          onClick={(event) => {
            event.stopPropagation();
            openRowMenu(event.currentTarget);
          }}
        >
          <EllipsisVerticalIcon className="size-3.5" />
        </Button>
      )}
    </>
  );

  const dragProps = enableDrag ? { ...listeners, ...attributes } : {};
  const hoverProps = cardHoverProps(onHover, card.cardId, card.preferredPrintingId);

  if (onClick) {
    return (
      <div
        ref={enableDrag ? setNodeRef : undefined}
        className={cn(enableDrag && "cursor-grab active:cursor-grabbing")}
        {...dragProps}
        {...hoverProps}
        onKeyDownCapture={menuButton ? handleMenuKey : undefined}
      >
        <div
          data-deck-card-id={card.cardId}
          className={cn(baseClass, "hover:bg-muted/50 w-full cursor-pointer")}
          style={domainTint}
          onContextMenu={onContextMenu}
          {...rowActivateProps(onClick, m.decks_card_row_view_details({ card: cardName }))}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={enableDrag ? setNodeRef : undefined}
      data-deck-card-id={card.cardId}
      className={cn(baseClass, enableDrag && "cursor-grab active:cursor-grabbing")}
      style={domainTint}
      onContextMenu={onContextMenu}
      {...dragProps}
      {...hoverProps}
      onKeyDownCapture={menuButton ? handleMenuKey : undefined}
    >
      {content}
    </div>
  );
}
