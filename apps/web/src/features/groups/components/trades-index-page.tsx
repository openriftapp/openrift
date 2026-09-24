import { Link } from "@tanstack/react-router";
import { BellIcon, CheckIcon, ChevronRightIcon, ShoppingCartIcon, UsersIcon } from "lucide-react";
import { Suspense } from "react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarActions,
  PageTopBarButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CardLink } from "@/components/ui/card-link";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { IconChip } from "@/components/ui/icon-chip";
import { SectionHeading } from "@/components/ui/section-heading";
import { UserAvatar } from "@/components/user-avatar";
import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import { CardDetailOverlayProvider } from "@/features/cards/components/card-detail-opener";
import { useCards } from "@/features/cards/hooks/use-cards";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { TradeMarket } from "@/features/groups/components/trade-market";
import { useUserTrades } from "@/features/groups/hooks/use-card-trades";
import { useFriendGroupsList } from "@/features/groups/hooks/use-friend-groups";
import { cartFor } from "@/features/groups/lib/buy-cart";
import { distinctPrintingIds } from "@/features/groups/lib/friend-group-activity";
import { needsYouLine } from "@/features/groups/lib/trade-hub";
import type { TradesIndexPerson } from "@/features/groups/lib/trades-index";
import { buildTradesIndex } from "@/features/groups/lib/trades-index";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { useRequiredUserId } from "@/lib/auth-session";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function artPrintingIds(person: TradesIndexPerson): string[] {
  if (person.needsYou.length > 0) {
    return distinctPrintingIds(person.needsYou);
  }
  return distinctPrintingIds(person.waiting);
}

function PersonCard({ person, showGroups }: { person: TradesIndexPerson; showGroups: boolean }) {
  const { printingsById } = useCards();
  const action = needsYouLine(person.needsYou);
  const art = artPrintingIds(person).map((printingId) => ({
    key: printingId,
    imageId: frontImageId(printingsById[printingId]),
  }));
  const waiting = person.needsYou.length > 0 ? 0 : person.waiting.length;

  return (
    <CardLink
      render={
        <Link
          to="/trades/$userId"
          params={{ userId: person.userId }}
          search={{ from: undefined }}
        />
      }
      className="gap-1.5 p-4"
    >
      <div className="flex items-center gap-2.5">
        <UserAvatar
          image={person.image}
          name={person.name}
          gravatarHash={person.gravatarHash}
          size="sm"
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {person.name ?? m.trades_member_fallback()}
        </span>
        <ChevronRightIcon className="text-muted-foreground/40 group-hover/card:text-muted-foreground size-4 shrink-0 transition-transform group-hover/card:translate-x-0.5" />
      </div>
      {showGroups ? (
        <p className="text-muted-foreground truncate text-xs">{person.groupNames.join(" · ")}</p>
      ) : null}
      {action === null ? null : <p className="text-foreground text-sm font-medium">{action}</p>}
      {art.length > 0 ? <CardArtThumbStack items={art} max={5} thumbClassName="w-8" /> : null}
      {waiting > 0 ? (
        <p className="text-muted-foreground text-sm">
          {m.trades_waiting_on_them({ count: waiting })}
        </p>
      ) : null}
      {person.doneCount > 0 ? (
        <p className="text-muted-foreground text-xs">
          {m.trades_done({ count: person.doneCount })}
        </p>
      ) : null}
    </CardLink>
  );
}

function PeopleGrid({ people, showGroups }: { people: TradesIndexPerson[]; showGroups: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {people.map((person) => (
        <PersonCard key={person.userId} person={person} showGroups={showGroups} />
      ))}
    </div>
  );
}

function NoGroupsCallout() {
  return (
    <Callout className="flex flex-wrap items-center gap-3">
      <IconChip icon={UsersIcon} tone="info" size="sm" shape="round" />
      <p className="text-muted-foreground min-w-0 flex-1">{m.trades_empty_description()}</p>
      <Button size="sm" variant="outline" render={<Link to="/groups" />}>
        {m.trades_go_to_groups()}
      </Button>
    </Callout>
  );
}

export function TradesIndexPage() {
  const userId = useRequiredUserId();
  const { data } = useUserTrades();
  const { data: groupsData } = useFriendGroupsList(true);
  const cartCount = useBuyCartStore((state) => cartFor(state.carts, userId).items.length);
  const index = buildTradesIndex(data?.items ?? []);
  const showGroups = index.groupCount > 1;
  const live = index.yourMove.length + index.waiting.length;
  const noGroups = groupsData !== undefined && groupsData.items.length === 0;

  return (
    <CardDetailOverlayProvider>
      <PageTopBarSticky width="full">
        <PageTopBar>
          <PageTopBarTitle>{m.trades_title()}</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarButton render={<Link to="/trades/buy" />}>
              <ShoppingCartIcon />
              {cartCount > 0
                ? m.trades_buy_cart_button_count({ count: cartCount })
                : m.trades_buy_cart_button()}
            </PageTopBarButton>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.full, "px-safe flex flex-col gap-8 pt-3 pb-12")}>
        <PageDescription>{m.trades_index_description()}</PageDescription>

        {noGroups ? <NoGroupsCallout /> : null}

        {index.yourMove.length > 0 ? (
          <section className="flex flex-col gap-3">
            <SectionHeading icon={BellIcon} tone="gold" count={index.yourMove.length}>
              {m.trades_section_your_move()}
            </SectionHeading>
            <PeopleGrid people={index.yourMove} showGroups={showGroups} />
          </section>
        ) : null}

        {index.waiting.length > 0 ? (
          <section className="flex flex-col gap-3">
            <SectionHeading count={index.waiting.length}>
              {m.trades_section_waiting()}
            </SectionHeading>
            <PeopleGrid people={index.waiting} showGroups={showGroups} />
          </section>
        ) : null}

        <Suspense fallback={null}>
          <TradeMarket />
        </Suspense>

        {index.past.length > 0 ? (
          <Collapsible defaultOpen={live === 0} className="flex flex-col gap-3">
            <SectionHeading as="h3">
              <CollapsibleTrigger className="group hover:text-foreground flex w-full items-center gap-2.5 text-left transition-colors">
                <IconChip icon={CheckIcon} size="sm" />
                {m.trades_traded_before({ count: index.past.length })}
                <ChevronRightIcon className="size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-90" />
              </CollapsibleTrigger>
            </SectionHeading>
            <CollapsibleContent>
              <PeopleGrid people={index.past} showGroups={showGroups} />
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </CardDetailOverlayProvider>
  );
}
