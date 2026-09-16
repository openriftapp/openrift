import type { Printing } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";
import { PackageIcon } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { useCardDetailActionHost } from "@/features/cards/components/card-detail/card-detail-action-host";
import { PrintingCountActions } from "@/features/cards/components/printing-count-actions";
import { WishlistButton } from "@/features/cards/components/wishlist-heart";
import { useTileOwnedCounts } from "@/features/collections/hooks/use-owned-count";
import { useUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

export function ownedSummary(ownedCount: number, cardTotal: number): string {
  if (cardTotal === 0) {
    return m.card_detail_own_none();
  }
  if (ownedCount === 0) {
    return m.card_detail_own_other_printing({ total: cardTotal });
  }
  if (cardTotal > ownedCount) {
    return m.card_detail_own_partial({ count: ownedCount, total: cardTotal });
  }
  return m.card_detail_own({ count: ownedCount });
}

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

  const siblingIds = siblings.map((sibling) => sibling.id);
  const {
    count: ownedCount,
    totalCount,
    total: cardTotal,
  } = useTileOwnedCounts(printing.id, siblingIds, enabled);
  const cardName = legendDisplayName(printing.card);

  return (
    <>
      <section className="flex flex-col gap-2">
        <SectionHeading icon={PackageIcon}>{m.card_detail_copies_title()}</SectionHeading>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-muted-foreground min-w-0 flex-1 text-sm">
            {ownedSummary(ownedCount, cardTotal)}
          </p>
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
            <WishlistButton
              entries={wish.entriesForPrinting(printing.cardId, printing.id)}
              cardName={cardName}
              onAdd={() => setWishTarget(printing)}
              align="end"
            />
            <div className="w-28">
              <PrintingCountActions
                printing={printing}
                siblings={siblings}
                count={ownedCount}
                totalCount={totalCount}
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
          </div>
        </div>
      </section>
      {hosts}
    </>
  );
}
