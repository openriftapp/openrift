import { formatRelativeTime, DAY_MS } from "@openrift/shared/format-date";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import type { CardTradeResponse, CardTradeStatus } from "@openrift/shared/types/api/card-trade";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Rarity } from "@openrift/shared/types/enums";
import { ClockIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PrintingVariantLine } from "@/features/cards/components/printing-row";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { DATE_WORDS } from "@/lib/date-words";
import { compactFormatterForMarketplace, priceColorClass } from "@/lib/format";
import { memberName } from "@/lib/member-name";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

const EXPIRY_URGENT_MS = DAY_MS;

function expiresWithinUrgentWindow(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() - Date.now() < EXPIRY_URGENT_MS;
}

export function CardMetaLine({
  printing,
  rarity,
  hideLanguage,
  trailing,
}: {
  printing?: Printing | null;
  rarity: Rarity;
  hideLanguage?: boolean;
  trailing?: ReactNode;
}) {
  const { printingsByCardId } = useCards();
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <RarityIcon rarity={rarity} labelled className="size-3.5" />
      {printing ? (
        <PrintingVariantLine
          printing={printing}
          siblings={printingsByCardId.get(printing.cardId)}
          hideLanguage={hideLanguage}
        />
      ) : null}
      {trailing}
    </span>
  );
}

export function TradePerCopyPrice({ printingId }: { printingId: string }) {
  const prices = usePrices();
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const unitPrice = prices.get(printingId, marketplace);
  if (unitPrice === undefined) {
    return null;
  }
  return (
    <>
      <span>·</span>
      <span
        className={cn("font-medium", priceColorClass(unitPrice))}
        title={m.trades_price_per_copy({ marketplace: marketplaceLabel(marketplace) })}
      >
        {m.trades_per_copy_amount({
          amount: compactFormatterForMarketplace(marketplace)(unitPrice),
        })}
      </span>
    </>
  );
}

export function TradeEstimatedPrice({
  printingId,
  quantity,
}: {
  printingId: string;
  quantity: number;
}) {
  const prices = usePrices();
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const unitPrice = prices.get(printingId, marketplace);
  if (unitPrice === undefined) {
    return null;
  }
  const total = unitPrice * quantity;
  return (
    <>
      <span>·</span>
      <span
        className={cn("font-medium", priceColorClass(total))}
        title={m.trades_estimated_value({ marketplace: marketplaceLabel(marketplace) })}
      >
        {compactFormatterForMarketplace(marketplace)(total)}
      </span>
    </>
  );
}

export function TradeExpiry({
  status,
  expiresAt,
}: {
  status: CardTradeStatus;
  expiresAt: string | null;
}) {
  if (status !== "pending" || expiresAt === null) {
    return null;
  }
  const label = formatRelativeTime(expiresAt, { words: DATE_WORDS });
  if (label === "") {
    return null;
  }
  const urgent = expiresWithinUrgentWindow(expiresAt);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap",
        urgent ? "text-warning font-medium" : "text-muted-foreground",
      )}
      title={m.trades_expiry_title()}
    >
      <ClockIcon className="size-3" />
      {label}
    </span>
  );
}

function liveTradeElsewhereText(trade: CardTradeResponse): string {
  const name = memberName(trade.counterparty.name);
  const count = trade.quantity;
  const pending = trade.status === "pending";
  const sent = trade.initiator === trade.role;
  if (trade.role === "receiver") {
    if (sent) {
      return pending
        ? m.trades_live_elsewhere_sent_request_pending({ name, count })
        : m.trades_live_elsewhere_sent_request_accepted({ name, count });
    }
    return pending
      ? m.trades_live_elsewhere_got_offer_pending({ name, count })
      : m.trades_live_elsewhere_got_offer_accepted({ name, count });
  }
  if (sent) {
    return pending
      ? m.trades_live_elsewhere_sent_offer_pending({ name, count })
      : m.trades_live_elsewhere_sent_offer_accepted({ name, count });
  }
  return pending
    ? m.trades_live_elsewhere_got_request_pending({ name, count })
    : m.trades_live_elsewhere_got_request_accepted({ name, count });
}

export function LiveTradesElsewhereLine({ trades }: { trades: readonly CardTradeResponse[] }) {
  if (trades.length === 0) {
    return null;
  }
  return (
    <span className="text-warning flex items-start gap-1.5 text-sm font-medium">
      <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
      <span className="flex min-w-0 flex-col">
        {trades.map((trade) => (
          <span key={trade.id}>{liveTradeElsewhereText(trade)}</span>
        ))}
      </span>
    </span>
  );
}
