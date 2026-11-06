import type { Printing } from "@openrift/shared/types/catalog";
import { AlertTriangleIcon, LayersIcon, MinusIcon, PackageIcon, PlusIcon } from "lucide-react";

import { CountPill } from "@/components/ui/count-pill";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CardStrip,
  StripActionButton,
  StripIconButton,
} from "@/features/cards/components/card-strip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface DeckAddStripProps {
  printing: Printing;
  ownedCount: number;
  deckQuantity: number;
  maxReached?: boolean;
  addLabel?: string;
  addAriaLabel?: string;
  addTooltip?: string;
  removeLabel?: string;
  shiftHeld?: boolean;
  remainingCount?: number;
  onQuickAdd: (printing: Printing, event: React.MouseEvent) => void;
  onRemove?: (printing: Printing, event: React.MouseEvent) => void;
  labelDeckCount?: boolean;
  warnLimit?: string;
}

export function DeckAddStrip({
  printing,
  ownedCount,
  deckQuantity,
  maxReached,
  addLabel,
  addAriaLabel,
  addTooltip,
  removeLabel,
  shiftHeld,
  remainingCount,
  onQuickAdd,
  onRemove,
  labelDeckCount,
  warnLimit,
}: DeckAddStripProps) {
  if (removeLabel && deckQuantity > 0 && onRemove) {
    return (
      <CardStrip
        right={
          <StripActionButton variant="destructive" onClick={(event) => onRemove(printing, event)}>
            {removeLabel}
          </StripActionButton>
        }
      />
    );
  }

  const showBulkAdd = shiftHeld && !addLabel && remainingCount !== undefined && remainingCount > 1;
  const showBulkRemove = shiftHeld && deckQuantity > 1;

  const ownedPill = (
    <CountPill
      variant="ghost"
      title={m.decks_editor_owned_count({ count: ownedCount })}
      className={cn(ownedCount === 0 && "opacity-50")}
    >
      <PackageIcon className="size-3" aria-hidden />
      <span>{ownedCount}</span>
      <span className="sr-only">{m.decks_editor_owned()}</span>
    </CountPill>
  );

  const deckPill = deckQuantity > 0 && (
    <CountPill
      variant="primary"
      title={warnLimit ?? m.decks_editor_in_deck_count({ count: deckQuantity })}
      className={cn(warnLimit && "bg-warning-soft text-warning")}
    >
      {warnLimit ? (
        <AlertTriangleIcon className="size-3" aria-hidden />
      ) : (
        <LayersIcon className="size-3" aria-hidden />
      )}
      {labelDeckCount ? (
        <span>{m.decks_editor_in_deck_count({ count: deckQuantity })}</span>
      ) : (
        <>
          <span>{deckQuantity}</span>
          <span className="sr-only">{m.decks_editor_in_deck()}</span>
        </>
      )}
    </CountPill>
  );

  const removeButton = deckQuantity > 0 && onRemove && (
    <Tooltip>
      <TooltipTrigger
        render={
          showBulkRemove ? (
            <StripActionButton
              variant="destructive"
              aria-label={m.decks_editor_remove_from_deck()}
              onClick={(event) => onRemove(printing, event)}
            />
          ) : (
            <StripIconButton
              className="text-muted-foreground"
              aria-label={m.decks_editor_remove_from_deck()}
              onClick={(event) => onRemove(printing, event)}
            />
          )
        }
      >
        {showBulkRemove ? `-${deckQuantity}` : <MinusIcon />}
      </TooltipTrigger>
      <TooltipContent>{m.decks_editor_shift_remove_all()}</TooltipContent>
    </Tooltip>
  );

  const addButton = (
    <Tooltip>
      <TooltipTrigger
        render={
          !maxReached && (addLabel || showBulkAdd) ? (
            <StripActionButton
              aria-label={addAriaLabel ?? m.decks_editor_add_to_deck()}
              onClick={(event) => onQuickAdd(printing, event)}
            />
          ) : (
            <StripIconButton
              className={maxReached ? "text-muted-foreground/30" : "text-muted-foreground"}
              disabled={maxReached}
              aria-label={addAriaLabel ?? m.decks_editor_add_to_deck()}
              onClick={(event) => onQuickAdd(printing, event)}
            />
          )
        }
      >
        {!maxReached && addLabel ? (
          addLabel
        ) : showBulkAdd && !maxReached ? (
          `+${remainingCount}`
        ) : (
          <PlusIcon />
        )}
      </TooltipTrigger>
      {!maxReached && (
        <TooltipContent>{warnLimit ?? addTooltip ?? m.decks_editor_shift_add_max()}</TooltipContent>
      )}
    </Tooltip>
  );

  return (
    <CardStrip
      left={removeButton}
      center={
        <>
          {ownedPill}
          {deckPill}
        </>
      }
      right={addButton}
    />
  );
}
