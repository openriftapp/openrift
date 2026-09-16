import type { Printing } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";

import { PrintingCountActions } from "@/features/cards/components/printing-count-actions";
import { WishlistButton } from "@/features/cards/components/wishlist-heart";
import type { WishEntryFlat } from "@/features/groups/lib/wish-entry";

export function CardDetailActions({
  printing,
  siblings,
  collectionId,
  showCount = true,
  wishEntries,
  onAddToWishlist,
  onIncrement,
  onDecrement,
  incrementDisabled,
  addLabel,
}: {
  printing: Printing;
  siblings?: readonly Printing[];
  /** Scopes the owned count to one collection. Omit for the count across all of them. */
  collectionId?: string;
  /** The catalog hides the stepper behind its own display toggle; the wishlist button stays. */
  showCount?: boolean;
  wishEntries: readonly WishEntryFlat[];
  onAddToWishlist: (printing: Printing) => void;
  onIncrement?: (printing: Printing) => void;
  onDecrement?: (printing: Printing, anchorEl: HTMLElement) => void;
  incrementDisabled?: boolean;
  addLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {showCount && (
        <div className="w-28">
          <PrintingCountActions
            printing={printing}
            siblings={siblings}
            collectionId={collectionId}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            incrementDisabled={incrementDisabled}
            addLabel={addLabel}
          />
        </div>
      )}
      <WishlistButton
        entries={wishEntries}
        cardName={legendDisplayName(printing.card)}
        onAdd={() => onAddToWishlist(printing)}
      />
    </div>
  );
}
