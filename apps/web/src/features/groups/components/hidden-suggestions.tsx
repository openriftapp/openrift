import type { TradeSuggestionDismissal } from "@openrift/shared/types/api/card-trade";

import { Disclosure } from "@/components/disclosure";
import { Button } from "@/components/ui/button";
import { useCards } from "@/features/cards/hooks/use-cards";
import { printingDisplayName } from "@/features/cards/lib/card-meta";
import { useRestoreSuggestion } from "@/features/groups/hooks/use-trade-dismissals";
import type { TradeMarketGroup } from "@/features/groups/lib/trade-market";
import { memberName } from "@/lib/member-name";
import { m } from "@/paraglide/messages.js";

function namesByUser(groups: readonly TradeMarketGroup[]): Map<string, string | null> {
  const names = new Map<string, string | null>();
  for (const group of groups) {
    for (const row of [...group.incoming, ...group.outgoing]) {
      names.set(row.counterpartyUserId, row.counterpartyName);
    }
  }
  return names;
}

export function HiddenSuggestions({
  dismissals,
  groups,
}: {
  dismissals: readonly TradeSuggestionDismissal[];
  groups: readonly TradeMarketGroup[];
}) {
  const { printingsById } = useCards();
  const restore = useRestoreSuggestion();
  if (dismissals.length === 0) {
    return null;
  }
  const names = namesByUser(groups);
  return (
    <Disclosure variant="heading" title={m.trades_market_hidden({ count: dismissals.length })}>
      <ul className="flex flex-col">
        {dismissals.map((dismissal) => {
          const printing = printingsById[dismissal.printingId];
          const card = printing === undefined ? "" : printingDisplayName(printing);
          const name = memberName(names.get(dismissal.counterpartyUserId));
          return (
            <li
              key={`${dismissal.direction}:${dismissal.counterpartyUserId}:${dismissal.printingId}`}
              className="flex items-center gap-3 border-b py-2 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate">
                {dismissal.direction === "incoming"
                  ? m.trades_market_hidden_incoming({ card, name })
                  : m.trades_market_hidden_outgoing({ card, name })}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={restore.isPending}
                onClick={() => restore.mutate(dismissal)}
              >
                {m.trades_market_show_again()}
              </Button>
            </li>
          );
        })}
      </ul>
    </Disclosure>
  );
}
