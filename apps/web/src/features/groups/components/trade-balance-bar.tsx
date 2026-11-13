import type { PriceTotal } from "@openrift/shared/card-price";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import type { ReactNode } from "react";

import { usePrices } from "@/features/cards/hooks/use-prices";
import { sumTradeValues } from "@/features/groups/lib/trade-derivation";
import { compactFormatterForMarketplace } from "@/lib/format";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

function cardCount(trades: readonly CardTradeResponse[], role: CardTradeResponse["role"]): number {
  return trades
    .filter((trade) => trade.role === role)
    .reduce((total, trade) => total + trade.quantity, 0);
}

/** In the marketplace's currency. */
const EVEN_THRESHOLD = 1;

export function TradeBalanceBar({ trades }: { trades: readonly CardTradeResponse[] }) {
  const prices = usePrices();
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);

  if (trades.length === 0) {
    return null;
  }

  const split = sumTradeValues(trades, (printingId) => prices.get(printingId, marketplace));
  const fmt = compactFormatterForMarketplace(marketplace);
  const giveCards = cardCount(trades, "giver");
  const getCards = cardCount(trades, "receiver");
  const priced = split.give.priced > 0 || split.get.priced > 0;

  // CSS shorts flex-grow when factors sum below 1 (Flexbox §9.7); normalize raw values first.
  const total = split.give.value + split.get.value;
  const giveShare = total > 0 ? split.give.value / total : 0.5;

  // Never labeled as anyone's "favor": the app can't see the cash side of a deal.
  const delta = split.get.value - split.give.value;
  const deltaText =
    Math.abs(delta) < EVEN_THRESHOLD
      ? m.trades_balance_even()
      : m.trades_balance_difference({ amount: fmt(Math.abs(delta)) });

  const sideLabel = (cards: number, value: PriceTotal): ReactNode => (
    <>
      <span className="text-foreground font-medium">{m.common_cards({ count: cards })}</span>
      {value.priced > 0 ? (
        <>
          {" "}
          {m.trades_balance_worth()}{" "}
          <span className="text-foreground font-medium">≈{fmt(value.value)}</span>
        </>
      ) : null}
      {value.unpriced > 0 ? ` ${m.common_unpriced({ count: value.unpriced })}` : null}
    </>
  );

  return (
    <div
      className="flex flex-col gap-1"
      title={m.trades_balance_title({ marketplace: marketplaceLabel(marketplace) })}
    >
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {m.trades_balance_you_give()} {sideLabel(giveCards, split.give)}
        </span>
        <span className="text-muted-foreground text-right">
          {m.trades_balance_you_get()} {sideLabel(getCards, split.get)}
        </span>
      </div>
      {priced ? (
        <>
          <div className="bg-muted flex h-1.5 overflow-hidden rounded-full">
            <span className="bg-warning/80 min-w-1" style={{ flexGrow: giveShare }} />
            <span className="w-0.5 shrink-0" />
            <span className="bg-success/80 min-w-1" style={{ flexGrow: 1 - giveShare }} />
          </div>
          <div className="text-muted-foreground/70 flex justify-between gap-3 text-xs">
            <span>{deltaText}</span>
            <span>{m.trades_balance_estimate({ marketplace: marketplaceLabel(marketplace) })}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
