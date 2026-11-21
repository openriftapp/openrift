import { legendDisplayName } from "@openrift/shared/card-name";
import { priceTotal } from "@openrift/shared/card-price";
import { matchesCardQuery } from "@openrift/shared/card-search";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronRightIcon, ClockIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CardList } from "@/components/ui/card-list";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { SectionHeading } from "@/components/ui/section-heading";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserAvatar } from "@/components/user-avatar";
import { UserAvatarStack } from "@/components/user-avatar-stack";
import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import { CardThumbnail } from "@/features/cards/components/card-thumbnail";
import { useCardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { printingArt } from "@/features/cards/lib/card-meta";
import { HiddenSuggestions } from "@/features/groups/components/hidden-suggestions";
import { TradeMarketSheet } from "@/features/groups/components/trade-market-sheet";
import { useUserTrades } from "@/features/groups/hooks/use-card-trades";
import { useDismissSuggestions } from "@/features/groups/hooks/use-trade-dismissals";
import { useTradeMarket } from "@/features/groups/hooks/use-trade-market";
import { useWantedCards } from "@/features/groups/hooks/use-wanted-cards";
import type { BuyCartItem } from "@/features/groups/lib/buy-cart";
import { cartFor, cartItemForWanted, cartTotal } from "@/features/groups/lib/buy-cart";
import { liveTradesForCard } from "@/features/groups/lib/trade-derivation";
import type { FinderPerson } from "@/features/groups/lib/trade-finder";
import { finderPeople } from "@/features/groups/lib/trade-finder";
import type { TradeMarketCard } from "@/features/groups/lib/trade-market";
import {
  filterMarketByGroup,
  marketDismissals,
  openMarketCards,
  sortByValue,
} from "@/features/groups/lib/trade-market";
import { tradePrinting } from "@/features/groups/lib/trade-printing";
import type { WantedCard } from "@/features/groups/lib/wanted-cards";
import { wantedMatchesPrinting } from "@/features/groups/lib/wanted-cards";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import type { TradeFinderView } from "@/features/groups/stores/trade-finder-store";
import {
  isPicked,
  TRADE_FINDER_VIEWS,
  useTradeFinderStore,
} from "@/features/groups/stores/trade-finder-store";
import { useRequiredUserId } from "@/hooks/use-session";
import { formatterForMarketplace } from "@/lib/format";
import { memberName } from "@/lib/member-name";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

const PANE_CARD_LIMIT = 8;
const PANE_GRID =
  "grid grid-cols-2 gap-x-3 gap-y-5 @md:grid-cols-3 @lg:grid-cols-4 @4xl:grid-cols-6 @6xl:grid-cols-8";
const PANE_GRID_SIZES = "(min-width: 1280px) 160px, (min-width: 640px) 25vw, 50vw";
const IN_TRADE_BADGE =
  // oxlint-disable-next-line shadcn/no-restyle -- solid warning tag over card art
  "pointer-events-none absolute bottom-1.5 left-1.5 z-30 bg-warning text-warning-foreground shadow-md";
const MAX_SOURCE_AVATARS = 3;

function whoLine(card: TradeMarketCard): string {
  const [first] = card.sources;
  const count = card.sources.length;
  if (count === 1 && first !== undefined) {
    const name = memberName(first.name);
    return card.direction === "incoming"
      ? m.trades_market_one_has({ name })
      : m.trades_market_one_wants({ name });
  }
  return card.direction === "incoming"
    ? m.trades_market_many_have({ count })
    : m.trades_market_many_want({ count });
}

function personLine(person: FinderPerson): string {
  const parts: string[] = [];
  if (person.get.length > 0) {
    parts.push(m.trades_finder_has_count({ count: person.get.length }));
  }
  if (person.give.length > 0) {
    parts.push(
      person.get.length > 0
        ? m.trades_finder_wants_count_after({ count: person.give.length })
        : m.trades_finder_wants_count({ count: person.give.length }),
    );
  }
  return parts.join(" · ");
}

function EmptyNote({ text }: { text: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function MarketTile({ card, showWho }: { card: TradeMarketCard; showWho: boolean }) {
  const selected = useTradeFinderStore((state) => isPicked(state.picked, card));
  const pick = useTradeFinderStore((state) => state.pick);
  const { printingsById, printingsByCardId } = useCards();
  const display = useCardThumbnailDisplay();
  const showImages = useDisplayStore((s) => s.showImages);
  const { data: userTrades } = useUserTrades();
  const printing = tradePrinting(card, printingsByCardId, printingsById);
  if (printing === undefined) {
    return null;
  }
  const liveTrades = liveTradesForCard(userTrades?.items ?? [], card.cardId, card.direction);
  const viewerStarted = liveTrades.some((trade) => trade.initiator === trade.role);
  return (
    <CardThumbnail
      printing={printing}
      showImages={showImages}
      display={display}
      sizes={PANE_GRID_SIZES}
      view="printings"
      imageOverlay={
        liveTrades.length > 0 ? (
          <Badge variant="warning" className={IN_TRADE_BADGE}>
            <ClockIcon />
            {viewerStarted
              ? card.direction === "incoming"
                ? m.trades_market_tile_requested()
                : m.trades_market_tile_offered()
              : m.trades_market_tile_in_trade()}
          </Badge>
        ) : undefined
      }
      selected={selected}
      onClick={() =>
        pick({ direction: card.direction, printingId: card.printingId, cardId: card.cardId })
      }
      belowLabel={
        showWho ? (
          <span className="text-muted-foreground mt-1 flex min-w-0 items-center gap-2 px-1.5 text-sm">
            <UserAvatarStack
              size="sm"
              members={card.sources.slice(0, MAX_SOURCE_AVATARS).map((source) => ({
                userId: source.userId,
                userName: source.name,
                userImage: source.image,
                gravatarHash: source.gravatarHash,
              }))}
            />
            <span className="truncate">{whoLine(card)}</span>
          </span>
        ) : undefined
      }
    />
  );
}

interface PaneProps {
  title: string;
  hint?: string;
  cards: readonly TradeMarketCard[];
  empty: string;
  showWho: boolean;
  wide?: boolean;
}

function CardPane({ title, hint, cards, empty, showWho, wide }: PaneProps) {
  const [showAll, setShowAll] = useState(false);
  const prices = usePrices();
  const display = useCardThumbnailDisplay();
  const formatPrice = formatterForMarketplace(display.favoriteMarketplace);
  const shown = showAll ? cards : cards.slice(0, PANE_CARD_LIMIT);
  const value = priceTotal(
    cards.map((card) => ({
      price: prices.get(card.printingId, display.favoriteMarketplace),
      quantity: 1,
    })),
  );
  const valueText =
    value.priced === 0
      ? ""
      : value.unpriced > 0
        ? `${formatPrice(value.value)} ${m.common_unpriced({ count: value.unpriced })}`
        : formatPrice(value.value);
  return (
    <section
      className={cn(
        "bg-card ring-border flex min-w-0 flex-col gap-4 rounded-lg p-3 ring-1 sm:p-4",
        wide && "md:col-span-2",
      )}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3">
        <h3 className="font-medium">
          {title}
          <span className="text-muted-foreground/60 ml-1.5 tabular-nums">{cards.length}</span>
        </h3>
        <span className="text-muted-foreground ml-auto text-sm">{hint ?? valueText}</span>
      </header>
      {cards.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="@container">
          <div className={PANE_GRID}>
            {shown.map((card) => (
              <MarketTile
                key={`${card.direction}:${card.printingId}:${card.cardId}`}
                card={card}
                showWho={showWho}
              />
            ))}
          </div>
        </div>
      )}
      {cards.length > shown.length ? (
        <Button variant="ghost" className="self-center" onClick={() => setShowAll(true)}>
          {m.trades_finder_show_all({ count: cards.length })}
          <ChevronDownIcon />
        </Button>
      ) : null}
    </section>
  );
}

function PersonRow({ person, fromGroupSlug }: { person: FinderPerson; fromGroupSlug?: string }) {
  const open = useTradeFinderStore((state) => state.openPersonId === person.userId);
  const togglePerson = useTradeFinderStore((state) => state.togglePerson);
  const dismiss = useDismissSuggestions();
  const { printingsById } = useCards();
  const name = memberName(person.name);
  const dismissals = [
    ...marketDismissals(person.get, person.userId),
    ...marketDismissals(person.give, person.userId),
  ];
  const art = person.get.slice(0, 5).map((card) => ({
    key: card.printingId,
    ...printingArt(printingsById[card.printingId]),
  }));
  const oneSided = person.get.length === 0 || person.give.length === 0;
  return (
    <li className={cn("flex flex-col rounded-md", open && "bg-muted/50")}>
      <ExpandToggle
        expanded={open}
        chevronPosition="end"
        onClick={() => togglePerson(person.userId)}
        className="hover:bg-muted/50 w-full gap-3 rounded-md p-3"
      >
        <UserAvatar
          image={person.image}
          name={person.name}
          gravatarHash={person.gravatarHash}
          size="sm"
        />
        <span className="flex min-w-0 flex-col sm:w-72 sm:flex-none">
          <span className="truncate font-medium">{name}</span>
          <span className="text-muted-foreground truncate text-sm">{personLine(person)}</span>
        </span>
        <span className="flex min-w-0 flex-1 justify-end sm:justify-start">
          {!open && art.length > 0 ? (
            <CardArtThumbStack items={art} max={5} thumbClassName="w-8" className="max-sm:hidden" />
          ) : null}
        </span>
      </ExpandToggle>
      {open ? (
        <div className="flex flex-col gap-4 pb-4 sm:px-3 sm:pl-14">
          <div className="grid gap-4 md:grid-cols-2">
            {person.get.length > 0 ? (
              <CardPane
                title={m.trades_finder_you_would_get()}
                cards={person.get}
                empty=""
                showWho={false}
                wide={oneSided}
              />
            ) : null}
            {person.give.length > 0 ? (
              <CardPane
                title={m.trades_finder_you_would_give()}
                cards={person.give}
                empty=""
                showWho={false}
                wide={oneSided}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/trades/$userId"
              params={{ userId: person.userId }}
              search={{ from: fromGroupSlug }}
              className={buttonVariants()}
            >
              {m.trades_finder_open_sheet()}
              <ChevronRightIcon />
            </Link>
            {dismissals.length === 0 ? null : (
              <Button
                variant="ghost"
                pending={dismiss.isPending}
                onClick={() => dismiss.mutate(dismissals)}
              >
                <EyeOffIcon />
                {m.trades_market_hide_person({ count: dismissals.length, name })}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function BuyStrip({
  missing,
  estimate,
  cartCount,
  groupName,
}: {
  missing: number;
  estimate: string | null;
  cartCount: number;
  groupName?: string;
}) {
  const missingLine =
    groupName === undefined
      ? m.trades_buy_strip_missing({ count: missing })
      : m.trades_buy_strip_missing_group({ count: missing, group: groupName });
  if (missing === 0 && cartCount === 0) {
    return null;
  }
  const title =
    missing === 0
      ? m.trades_buy_strip_cart_only({ count: cartCount })
      : cartCount > 0
        ? `${missingLine} · ${m.trades_buy_strip_in_cart({ count: cartCount })}`
        : missingLine;
  return (
    <Callout className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium">{title}</p>
        {missing > 0 && estimate !== null ? (
          <p className="text-muted-foreground text-xs">
            {m.trades_buy_strip_estimate({ price: estimate, count: missing })}
          </p>
        ) : null}
      </div>
      <Link
        to="/trades/buy"
        className={buttonVariants({ variant: "outline", className: "max-sm:w-full" })}
      >
        {missing === 0 ? m.trades_market_view_cart() : m.trades_buy_cart_button()}
        <ChevronRightIcon />
      </Link>
    </Callout>
  );
}

export function TradeFinder({
  groupSlug,
  groupName,
}: {
  groupSlug: string | null;
  groupName?: string;
}) {
  const userId = useRequiredUserId();
  const { printingsById, printingsByCardId } = useCards();
  const prices = usePrices();
  const display = useCardThumbnailDisplay();
  const view = useTradeFinderStore((state) => state.view);
  const setView = useTradeFinderStore((state) => state.setView);
  const { market, marketGroups, dismissals } = useTradeMarket();
  const { data: userTrades } = useUserTrades();
  const userTradeItems = userTrades?.items ?? [];
  const [query, setQuery] = useState("");
  const picked = useTradeFinderStore((state) => state.picked);
  const pick = useTradeFinderStore((state) => state.pick);
  const { wanted, ready: wantedReady } = useWantedCards(true);

  const cartItems = useBuyCartStore((state) => cartFor(state.carts, userId).items);
  const addItems = useBuyCartStore((state) => state.addItems);
  const removeItems = useBuyCartStore((state) => state.removeItems);
  const cartKeys = new Set(cartItems.map((item) => item.key));

  const cardtraderPrice = formatterForMarketplace("cardtrader");
  const priceOf = (printingId: string): string | null => {
    const value = prices.get(printingId, "cardtrader");
    return value === undefined ? null : cardtraderPrice(value);
  };
  const nameOf = (ref: { cardId: string; printingId: string }): string => {
    const printing = tradePrinting(ref, printingsByCardId, printingsById);
    return printing === undefined ? "" : legendDisplayName(printing.card);
  };
  const shownPrintingId = (item: WantedCard): string | undefined =>
    item.printingId ?? printingsByCardId.get(item.cardId)?.[0]?.printingId;
  const toggleCart = (item: WantedCard) => {
    if (cartKeys.has(item.key)) {
      removeItems(userId, [item.key]);
      return;
    }
    const cartItem = cartItemForWanted(item, shownPrintingId(item));
    if (cartItem !== null) {
      addItems(userId, [cartItem]);
    }
  };
  const wantedForCard = (card: TradeMarketCard): WantedCard | undefined =>
    wanted.find((item) => wantedMatchesPrinting(item, card.cardId, card.printingId));

  const searching = query.trim().length > 0;
  const byValue = (cards: readonly TradeMarketCard[]) =>
    sortByValue(
      cards.filter((card) => !searching || matchesCardQuery(query, [nameOf(card)])),
      (card) => prices.get(card.printingId, display.favoriteMarketplace),
      (card) => nameOf(card),
    );

  const incomingInGroup = filterMarketByGroup(market.incoming, groupSlug);
  const outgoingInGroup = filterMarketByGroup(market.outgoing, groupSlug);
  const incoming = byValue(openMarketCards(incomingInGroup, userTradeItems));
  const outgoing = byValue(openMarketCards(outgoingInGroup, userTradeItems));
  const people = finderPeople(incoming, outgoing);

  const offeredRows = marketGroups
    .filter((entry) => groupSlug === null || entry.slug === groupSlug)
    .flatMap((entry) => entry.incoming);
  const missing = wanted.filter(
    (item) => !offeredRows.some((row) => wantedMatchesPrinting(item, row.cardId, row.printingId)),
  );
  const missingItems = missing.flatMap((item): BuyCartItem[] => {
    const cartItem = cartItemForWanted(item, shownPrintingId(item));
    return cartItem === null ? [] : [cartItem];
  });
  const estimate = cartTotal(missingItems, (printingId) => prices.get(printingId, "cardtrader"));

  const pickedCard =
    picked === null
      ? undefined
      : (picked.direction === "incoming" ? incomingInGroup : outgoingInGroup).find(
          (card) => card.printingId === picked.printingId && card.cardId === picked.cardId,
        );

  const nothingAtAll = userTrades !== undefined && incoming.length + outgoing.length === 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <SectionHeading>{m.trades_section_find()}</SectionHeading>
        <ToggleGroup
          variant="outline"
          aria-label={m.trades_finder_view_label()}
          value={[view]}
          onValueChange={(value) => {
            const [next] = value;
            if (TRADE_FINDER_VIEWS.includes(next as TradeFinderView)) {
              setView(next as TradeFinderView);
            }
          }}
          className="max-sm:w-full max-sm:*:flex-1"
        >
          <ToggleGroupItem value="person">{m.trades_finder_by_person()}</ToggleGroupItem>
          <ToggleGroupItem value="card">{m.trades_finder_by_card()}</ToggleGroupItem>
        </ToggleGroup>
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={m.trades_market_search_placeholder()}
          className="w-full sm:w-64"
        />
      </div>

      {nothingAtAll ? (
        <EmptyNote text={searching ? m.trades_market_no_match() : m.trades_finder_empty()} />
      ) : view === "person" ? (
        <CardList className="divide-border gap-0 divide-y">
          {people.map((person) => (
            <PersonRow key={person.userId} person={person} fromGroupSlug={groupSlug ?? undefined} />
          ))}
        </CardList>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <CardPane
            title={m.trades_market_tab_get()}
            hint={m.trades_finder_from_wishlists()}
            cards={incoming}
            empty={searching ? m.trades_market_no_match() : m.trades_market_empty_get()}
            showWho
          />
          <CardPane
            title={m.trades_market_tab_give()}
            hint={m.trades_finder_from_tradelists()}
            cards={outgoing}
            empty={searching ? m.trades_market_no_match() : m.trades_market_empty_give()}
            showWho
          />
        </div>
      )}

      <HiddenSuggestions dismissals={dismissals} groups={marketGroups} />

      <BuyStrip
        missing={wantedReady ? missing.length : 0}
        estimate={
          wantedReady
            ? estimate.unpriced > 0
              ? `${cardtraderPrice(estimate.total)} ${m.common_unpriced({ count: estimate.unpriced })}`
              : cardtraderPrice(estimate.total)
            : null
        }
        cartCount={cartItems.length}
        groupName={groupName}
      />

      <TradeMarketSheet
        card={pickedCard ?? null}
        onClose={() => pick(null)}
        wantedForCard={wantedForCard}
        cartKeys={cartKeys}
        onToggleCart={toggleCart}
        priceOf={priceOf}
      />
    </section>
  );
}
