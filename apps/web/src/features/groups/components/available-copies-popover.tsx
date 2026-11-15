import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OwnedCardBreakdown } from "@/features/cards/components/owned-card-breakdown";
import { m } from "@/paraglide/messages.js";

/**
 * The "N available" count on an outgoing suggestion, opened up into what the
 * viewer actually owns of that card.
 *
 * Outgoing rows only. On an incoming row the same number counts the *other*
 * side's copies.
 */
export function AvailableCopiesPopover({
  cardId,
  availableCount,
}: {
  cardId: string;
  availableCount: number;
}) {
  return (
    <Popover>
      <PopoverTrigger
        // The suggestion row around this one is clickable on some surfaces.
        onClick={(event) => event.stopPropagation()}
        className="hover:text-foreground focus-visible:ring-ring cursor-pointer underline decoration-dotted underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {m.trades_available_count({ count: availableCount })}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-60 p-0">
        <OwnedCardBreakdown cardId={cardId} />
      </PopoverContent>
    </Popover>
  );
}
