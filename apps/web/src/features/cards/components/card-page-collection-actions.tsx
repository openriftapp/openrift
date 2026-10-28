import { legendDisplayName } from "@openrift/shared/card-name";
import type { Printing } from "@openrift/shared/types/catalog";

import { useCardDetailActionHost } from "@/features/cards/components/card-detail/card-detail-action-host";
import { CardDetailActions } from "@/features/cards/components/card-detail/card-detail-actions";
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
      <CardDetailActions
        printing={printing}
        siblings={siblings}
        count={ownedCount}
        onIncrement={addCopy}
        onDecrement={removeCopy}
        incrementDisabled={!canAdd}
        addLabel={
          inbox ? m.card_detail_add_card_to({ card: cardName, collection: inbox.name }) : undefined
        }
        wishEntries={wish.entriesForPrinting(printing.cardId, printing.printingId)}
        onAddToWishlist={setWishTarget}
      />
      {hosts}
    </>
  );
}
