import { legendDisplayName } from "@openrift/shared/card-name";
import { Link } from "@tanstack/react-router";
import { BellIcon, CheckIcon, ChevronRightIcon, ShoppingCartIcon, UsersIcon } from "lucide-react";
import { Suspense } from "react";

import { Disclosure } from "@/components/disclosure";
import { PageHero } from "@/components/layout/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CardLink } from "@/components/ui/card-link";
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
import { needsYouLine, nextMoveLabel } from "@/features/groups/lib/trade-hub";
import type { TradesIndexPerson } from "@/features/groups/lib/trades-index";
import { buildTradesIndex } from "@/features/groups/lib/trades-index";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { useRequiredUserId } from "@/hooks/use-session";
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

function YourMoveRow({ person }: { person: TradesIndexPerson }) {
  const { cardsById } = useCards();
  const action = needsYouLine(person.needsYou);
  const cardNames = [
    ...new Set(
      person.needsYou.flatMap((trade) => {
        const card = cardsById[trade.cardId];
        return card === undefined ? [] : [legendDisplayName(card)];
      }),
    ),
  ].join(", ");
  return (
    <div className="bg-card border-primary/45 flex w-72 shrink-0 items-start gap-3 rounded-lg border p-3 sm:w-auto">
      <UserAvatar
        image={person.image}
        name={person.name}
        gravatarHash={person.gravatarHash}
        size="sm"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium">
            {person.name ?? m.trades_member_fallback()}
          </span>
          <Link
            to="/trades/$userId"
            params={{ userId: person.userId }}
            search={{ from: undefined }}
            className={buttonVariants({ size: "sm", className: "shrink-0" })}
          >
            {nextMoveLabel(person.needsYou[0])}
          </Link>
        </div>
        {action === null ? null : <span className="truncate text-sm">{action}</span>}
        {cardNames === "" ? null : (
          <span className="text-muted-foreground truncate text-sm">{cardNames}</span>
        )}
      </div>
    </div>
  );
}

function NoGroupsCallout() {
  return (
    <Callout className="flex flex-wrap items-center gap-3">
      <IconChip icon={UsersIcon} tone="info" size="sm" shape="round" />
      <p className="text-muted-foreground min-w-0 flex-1">{m.trades_empty_description()}</p>
      <Link to="/groups" className={buttonVariants({ variant: "outline", size: "sm" })}>
        {m.trades_go_to_groups()}
      </Link>
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
  const groupCount = groupsData?.items.length ?? 0;
  const noGroups = groupsData !== undefined && groupCount === 0;

  return (
    <CardDetailOverlayProvider>
      <PageHero
        width="full"
        eyebrow={groupCount > 0 ? m.trades_hero_eyebrow({ count: groupCount }) : undefined}
        title={m.trades_title()}
        lead={m.trades_hero_lead()}
      >
        <Link
          to="/trades/buy"
          className={buttonVariants({ variant: "outline", className: "mt-3" })}
        >
          <ShoppingCartIcon />
          {cartCount > 0
            ? m.trades_buy_cart_button_count({ count: cartCount })
            : m.trades_buy_cart_button()}
        </Link>
      </PageHero>

      <div className={cn(PAGE_WIDTH.full, "px-safe flex flex-col gap-8 pt-3 pb-12")}>
        {noGroups ? <NoGroupsCallout /> : null}

        {index.yourMove.length > 0 ? (
          <section className="flex flex-col gap-3">
            <SectionHeading icon={BellIcon} tone="gold" count={index.yourMove.length}>
              {m.trades_section_your_move()}
            </SectionHeading>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {index.yourMove.map((person) => (
                <YourMoveRow key={person.userId} person={person} />
              ))}
            </div>
          </section>
        ) : null}

        <Suspense fallback={null}>
          <TradeMarket />
        </Suspense>

        {index.waiting.length > 0 ? (
          <Disclosure
            variant="heading"
            defaultOpen={index.yourMove.length === 0}
            title={m.trades_section_waiting()}
            count={index.waiting.length}
          >
            <PeopleGrid people={index.waiting} showGroups={showGroups} />
          </Disclosure>
        ) : null}

        {index.past.length > 0 ? (
          <Disclosure
            variant="heading"
            defaultOpen={live === 0}
            icon={CheckIcon}
            title={m.trades_traded_before({ count: index.past.length })}
          >
            <PeopleGrid people={index.past} showGroups={showGroups} />
          </Disclosure>
        ) : null}
      </div>
    </CardDetailOverlayProvider>
  );
}
