import type { TradeSuggestionDismissal } from "@openrift/shared/types/api/card-trade";
import type { FriendGroupSummaryResponse } from "@openrift/shared/types/api/friend-group";

import { useUserTrades } from "@/features/groups/hooks/use-card-trades";
import {
  useFriendGroupMatchPanels,
  useFriendGroupsList,
} from "@/features/groups/hooks/use-friend-groups";
import { useTradeDismissals } from "@/features/groups/hooks/use-trade-dismissals";
import { dismissalKeys } from "@/features/groups/lib/trade-dismissals";
import type { TradeMarket, TradeMarketGroup } from "@/features/groups/lib/trade-market";
import { buildTradeMarket } from "@/features/groups/lib/trade-market";

export function useTradeMarket(): {
  market: TradeMarket;
  groups: FriendGroupSummaryResponse[];
  marketGroups: TradeMarketGroup[];
  dismissals: TradeSuggestionDismissal[];
} {
  const { data: groupsData } = useFriendGroupsList(true);
  const groups = groupsData?.items ?? [];
  const panels = useFriendGroupMatchPanels(groups.map((group) => group.slug));
  const { data: tradesData } = useUserTrades();
  const dismissals = useTradeDismissals();
  const groupNames = new Map(groups.map((group) => [group.slug, group.name]));
  const marketGroups = panels.map((panel) => ({
    slug: panel.slug,
    name: groupNames.get(panel.slug) ?? panel.slug,
    incoming: panel.incoming,
    outgoing: panel.outgoing,
  }));
  const market = buildTradeMarket(marketGroups, tradesData?.items ?? [], dismissalKeys(dismissals));
  return { market, groups, marketGroups, dismissals };
}
