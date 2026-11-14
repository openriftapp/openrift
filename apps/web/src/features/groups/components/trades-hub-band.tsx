import { needsViewerAction } from "@openrift/shared/card-trade-lifecycle";
import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, ZapIcon } from "lucide-react";

import { ActionBand } from "@/components/ui/action-band";
import { buttonVariants } from "@/components/ui/button";
import { useCards } from "@/features/cards/hooks/use-cards";
import { printingArt } from "@/features/cards/lib/card-meta";
import { TradeShelfRowView } from "@/features/groups/components/trade-shelf-row";
import { useGroupTrades, useUserTrades } from "@/features/groups/hooks/use-card-trades";
import { useFriendGroupMatches } from "@/features/groups/hooks/use-friend-groups";
import { withoutLiveTradeMatches } from "@/features/groups/lib/trade-derivation";
import type { TradeShelfRow } from "@/features/groups/lib/trade-hub";
import { buildTradeShelf } from "@/features/groups/lib/trade-hub";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function ShelfRow({
  row,
  printingsById,
}: {
  row: TradeShelfRow;
  printingsById: ReturnType<typeof useCards>["printingsById"];
}) {
  const items = row.printingIds.map((printingId) => ({
    key: printingId,
    ...printingArt(printingsById[printingId]),
  }));
  return <TradeShelfRowView label={row.label} tone={row.tone} items={items} detail={row.detail} />;
}

export function TradesHubBand({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  const { data: matches } = useFriendGroupMatches(slug);
  const { data: tradesData } = useGroupTrades(data.group.id);
  const { data: allTradesData } = useUserTrades();
  const { printingsById } = useCards();

  const trades = tradesData?.items ?? [];
  // Falls back to this group's own trades until the all-groups list loads.
  const liveTrades = allTradesData?.items ?? trades;
  const shelf = buildTradeShelf({
    needsYou: trades.filter((trade) => needsViewerAction(trade)),
    incoming: withoutLiveTradeMatches(matches.othersHaveYourWants, liveTrades, "incoming"),
    outgoing: withoutLiveTradeMatches(matches.othersWantYourHaves, liveTrades, "outgoing"),
  });

  const needsAction = shelf.waitingPeople > 0;
  if (shelf.rows.length === 0) {
    return null;
  }
  return (
    <ActionBand
      render={<Link to="/groups/$slug/trades" params={{ slug }} />}
      icon={ZapIcon}
      tone={needsAction ? "gold" : shelf.rows.length > 0 ? "success" : "neutral"}
      accent={needsAction}
      label={m.trades_title()}
      value={shelf.headline}
      valueClassName="font-sans truncate text-base font-medium"
      action={
        <span
          className={cn(
            buttonVariants({ variant: needsAction ? "default" : "ghost" }),
            needsAction && "group-hover/action-band:bg-primary/90",
          )}
        >
          {m.trades_view_trades()}
          <ChevronRightIcon className="size-4 transition-transform group-hover/action-band:translate-x-0.5" />
        </span>
      }
    >
      {shelf.rows.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {shelf.rows.map((row) => (
            <ShelfRow key={row.key} row={row} printingsById={printingsById} />
          ))}
        </ul>
      ) : null}
    </ActionBand>
  );
}
