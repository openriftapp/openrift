import type { TradeSuggestionDismissal } from "@openrift/shared/types/api/card-trade";
import type { FriendGroupSummaryResponse } from "@openrift/shared/types/api/friend-group";

import { useCards } from "@/features/cards/hooks/use-cards";
import { useUserTrades } from "@/features/groups/hooks/use-card-trades";
import {
  useFriendGroupMatchPanels,
  useFriendGroupsList,
} from "@/features/groups/hooks/use-friend-groups";
import { useTradeDismissals } from "@/features/groups/hooks/use-trade-dismissals";
import { liveOnlyMatchRows } from "@/features/groups/lib/trade-derivation";
import { dismissalKeys } from "@/features/groups/lib/trade-dismissals";
import type { TradeMarket, TradeMarketGroup } from "@/features/groups/lib/trade-market";
import { buildTradeMarket } from "@/features/groups/lib/trade-market";
import { tradePrinting } from "@/features/groups/lib/trade-printing";

export function useTradeMarket(): {
  market: TradeMarket;
  groups: FriendGroupSummaryResponse[];
  marketGroups: TradeMarketGroup[];
  dismissals: TradeSuggestionDismissal[];
} {
  const { data: groupsData } = useFriendGroupsList(true);
  const groups = groupsData?.items ?? [];
  const panels = useFriendGroupMatchPanels(groups.map((group) => group.slug));
  const dismissals = useTradeDismissals();
  const groupNames = new Map(groups.map((group) => [group.slug, group.name]));
  const { data: tradesData } = useUserTrades();
  const { printingsByCardId, printingsById } = useCards();
  const printingOf = (trade: { cardId: string; printingId: string }) =>
    tradePrinting(trade, printingsByCardId, printingsById);
  const marketGroups = panels.map((panel) => {
    const groupTrades = (tradesData?.items ?? []).filter((trade) => trade.groupSlug === panel.slug);
    return {
      slug: panel.slug,
      name: groupNames.get(panel.slug) ?? panel.slug,
      incoming: [
        ...panel.incoming,
        ...liveOnlyMatchRows(groupTrades, panel.incoming, "incoming", printingOf),
      ],
      outgoing: [
        ...panel.outgoing,
        ...liveOnlyMatchRows(groupTrades, panel.outgoing, "outgoing", printingOf),
      ],
    };
  });
  const market = buildTradeMarket(marketGroups, dismissalKeys(dismissals));
  return { market, groups, marketGroups, dismissals };
}
