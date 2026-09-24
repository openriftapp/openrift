import type { TradeSuggestionDismissal } from "@openrift/shared/types/api/card-trade";
import { legendDisplayName } from "@openrift/shared/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, EyeOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SectionHeading } from "@/components/ui/section-heading";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserAvatar } from "@/components/user-avatar";
import { useCards } from "@/features/cards/hooks/use-cards";
import {
  useDismissSuggestions,
  useRestoreSuggestion,
} from "@/features/groups/hooks/use-trade-dismissals";
import type {
  TradeMarket,
  TradeMarketGroup,
  TradeMarketPerson,
} from "@/features/groups/lib/trade-market";
import { marketDismissals } from "@/features/groups/lib/trade-market";
import { m } from "@/paraglide/messages.js";

const ALL_PEOPLE = "all";

export function PeopleFilter({
  people,
  personId,
  onPersonChange,
}: {
  people: readonly TradeMarketPerson[];
  personId: string | null;
  onPersonChange: (personId: string | null) => void;
}) {
  if (people.length < 2) {
    return null;
  }
  return (
    <ToggleGroup
      variant="outline"
      aria-label={m.trades_market_people_filter()}
      value={[personId ?? ALL_PEOPLE]}
      onValueChange={(value) => {
        const [next] = value;
        onPersonChange(next === undefined || next === ALL_PEOPLE ? null : next);
      }}
      className="flex-wrap"
    >
      <ToggleGroupItem value={ALL_PEOPLE}>{m.trades_market_everyone()}</ToggleGroupItem>
      {people.map((person) => (
        <ToggleGroupItem key={person.userId} value={person.userId} className="gap-2">
          <UserAvatar
            image={person.image}
            name={person.name}
            gravatarHash={person.gravatarHash}
            size="sm"
          />
          {person.name ?? m.trades_member_fallback()}
          <span className="text-muted-foreground tabular-nums">{person.cardCount}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function PersonActions({
  market,
  person,
}: {
  market: TradeMarket;
  person: TradeMarketPerson;
}) {
  const dismiss = useDismissSuggestions();
  const name = person.name ?? m.trades_member_fallback();
  const dismissals = marketDismissals(market, person.userId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        render={
          <Link
            to="/trades/$userId"
            params={{ userId: person.userId }}
            search={{ from: undefined }}
          />
        }
      >
        {m.trades_market_open_sheet({ name })}
        <ChevronRightIcon />
      </Button>
      {dismissals.length === 0 ? null : (
        <Button
          size="sm"
          variant="ghost"
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate(dismissals)}
        >
          <EyeOffIcon />
          {m.trades_market_hide_person({ count: dismissals.length, name })}
        </Button>
      )}
    </div>
  );
}

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
    <Collapsible className="flex flex-col gap-3">
      <SectionHeading as="h3">
        <CollapsibleTrigger className="group hover:text-foreground flex w-full items-center gap-2.5 text-left transition-colors">
          <EyeOffIcon className="size-4 shrink-0" />
          {m.trades_market_hidden({ count: dismissals.length })}
          <ChevronRightIcon className="size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-90" />
        </CollapsibleTrigger>
      </SectionHeading>
      <CollapsibleContent>
        <ul className="flex flex-col">
          {dismissals.map((dismissal) => {
            const printing = printingsById[dismissal.printingId];
            const card = printing === undefined ? "" : legendDisplayName(printing.card);
            const name = names.get(dismissal.counterpartyUserId) ?? m.trades_member_fallback();
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
      </CollapsibleContent>
    </Collapsible>
  );
}
