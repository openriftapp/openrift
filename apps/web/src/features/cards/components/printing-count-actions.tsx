import type { Printing } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";

import { CardCountStrip } from "@/features/cards/components/card-count-strip";
import { OwnedCollectionsPopover } from "@/features/cards/components/card-detail/owned-collections-popover";
import {
  dispatchDecrement,
  dispatchIncrement,
} from "@/features/cards/stores/card-row-actions-store";
import { useTileOwnedCounts } from "@/features/collections/hooks/use-owned-count";
import { useHydrated } from "@/hooks/use-hydrated";
import { m } from "@/paraglide/messages.js";

/**
 * `useTileOwnedCounts` is a live query, so the count is gated behind
 * hydration like every other consumer. Pass `count` to skip it entirely when
 * the caller already holds the numbers.
 */
export function PrintingCountActions({
  printing,
  collectionId,
  siblings,
  count,
  totalCount,
  onIncrement,
  onDecrement,
  incrementDisabled,
  addLabel,
}: {
  printing: Printing;
  /** Scopes the primary count to one collection. Omit for the count across all of them. */
  collectionId?: string;
  /** Variants of the same card to widen the total across. Defaults to this printing alone. */
  siblings?: readonly Printing[];
  count?: number;
  totalCount?: number;
  onIncrement?: (printing: Printing) => void;
  onDecrement?: (printing: Printing, anchorEl: HTMLElement) => void;
  incrementDisabled?: boolean;
  /** Overrides the add button's label, for a surface that knows its add target by name. */
  addLabel?: string;
}) {
  const hydrated = useHydrated();
  const siblingIds = siblings?.map((sibling) => sibling.id);
  const queried = useTileOwnedCounts(
    printing.id,
    siblingIds,
    hydrated && count === undefined,
    collectionId,
  );
  const ownedCount = count ?? queried.count;
  const widerTotal = count === undefined ? queried.totalCount : totalCount;
  const cardName = legendDisplayName(printing.card);
  const breakdownSiblings = siblings && siblings.length > 1 ? siblings : undefined;

  return (
    <CardCountStrip
      count={ownedCount}
      totalCount={widerTotal}
      pillOverride={
        ownedCount > 0 ? (
          <OwnedCollectionsPopover
            printingId={printing.id}
            cardName={cardName}
            shortCode={printing.shortCode}
            count={ownedCount}
            totalCount={widerTotal}
            siblings={breakdownSiblings}
          />
        ) : undefined
      }
      decrement={
        ownedCount > 0
          ? {
              onClick: (event) =>
                onDecrement
                  ? onDecrement(printing, event.currentTarget)
                  : dispatchDecrement(printing, event.currentTarget),
              ariaLabel: m.card_detail_remove_card({ card: cardName }),
            }
          : undefined
      }
      increment={{
        onClick: () => (onIncrement ? onIncrement(printing) : dispatchIncrement(printing)),
        disabled: incrementDisabled,
        ariaLabel: addLabel ?? m.card_detail_add_card({ card: cardName }),
      }}
    />
  );
}
