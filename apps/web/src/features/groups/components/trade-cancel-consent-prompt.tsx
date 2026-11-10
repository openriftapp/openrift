import { CatchBoundary } from "@tanstack/react-router";
import { Suspense } from "react";

import { useCards } from "@/features/cards/hooks/use-cards";
import { printingDisplayName } from "@/features/cards/lib/card-meta";
import type { CancelledTrade } from "@/features/groups/components/trade-cancel-consent-dialog";
import { TradeCancelConsentDialog } from "@/features/groups/components/trade-cancel-consent-dialog";
import { tradePrinting } from "@/features/groups/lib/trade-printing";
import { m } from "@/paraglide/messages.js";

function NamedDialog({ trades }: { trades: CancelledTrade[] }) {
  const { cardsById, printingsById, printingsByCardId } = useCards();
  const cardName = (trade: CancelledTrade): string => {
    const printing = tradePrinting(trade, printingsByCardId, printingsById);
    return printing
      ? printingDisplayName(printing)
      : (cardsById[trade.cardId]?.name ?? m.trades_card_fallback());
  };
  return <TradeCancelConsentDialog trades={trades} cardName={cardName} />;
}

export function TradeCancelConsentPrompt({ trades }: { trades: CancelledTrade[] }) {
  const unnamed = (
    <TradeCancelConsentDialog trades={trades} cardName={() => m.trades_card_fallback()} />
  );
  return (
    <CatchBoundary
      getResetKey={() => trades.map((trade) => trade.id).join(",")}
      errorComponent={() => unnamed}
    >
      <Suspense fallback={unnamed}>
        <NamedDialog trades={trades} />
      </Suspense>
    </CatchBoundary>
  );
}
