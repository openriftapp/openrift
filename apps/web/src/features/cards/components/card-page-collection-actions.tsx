import { legendDisplayName } from "@openrift/shared/card-name";
import type { Printing } from "@openrift/shared/types/catalog";

import { useCardDetailActionHost } from "@/features/cards/components/card-detail/card-detail-action-host";
import { PrintingCountActions } from "@/features/cards/components/printing-count-actions";
import { WishlistButton } from "@/features/cards/components/wishlist-heart";
import { useTileOwnedCounts } from "@/features/collections/hooks/use-owned-count";
import { useUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";

// Every count here comes from a live query with no server snapshot; the card
// page is full-SSR, so this must only ever be mounted behind `useHydrated()`.
export function CardPageCollectionActions({
  printing,
  siblings,
}: {
  printing: Printing;
  siblings: readonly Printing[];
}) {
  const userId = useUserId();
  const enabled = Boolean(userId);
  const printingsByCardId = new Map([[printing.cardId, [...siblings]]]);
  const { inbox, canAdd, addCopy, removeCopy, wish, setWishTarget, hosts } =
    useCardDetailActionHost({ printingsByCardId, enabled });

  const siblingIds = siblings.map((sibling) => sibling.printingId);
  const { count: ownedCount } = useTileOwnedCounts(printing.printingId, siblingIds, enabled);
  const cardName = legendDisplayName(printing.card);

  return (
    <>
      <div className="bg-card flex items-center justify-between gap-2 rounded-lg border py-1 pr-1 pl-3">
        <span className="text-muted-foreground text-sm">{m.cards_label_owned()}</span>
        <div className="flex items-center gap-2">
          <div className="w-28">
            <PrintingCountActions
              printing={printing}
              siblings={siblings}
              count={ownedCount}
              onIncrement={addCopy}
              onDecrement={removeCopy}
              incrementDisabled={!canAdd}
              addLabel={
                inbox
                  ? m.card_detail_add_card_to({ card: cardName, collection: inbox.name })
                  : undefined
              }
            />
          </div>
          <WishlistButton
            entries={wish.entriesForPrinting(printing.cardId, printing.printingId)}
            cardName={cardName}
            onAdd={() => setWishTarget(printing)}
            align="end"
          />
        </div>
      </div>
      {hosts}
    </>
  );
}
