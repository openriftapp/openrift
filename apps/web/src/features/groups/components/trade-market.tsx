import { matchesCardQuery } from "@openrift/shared/card-search";
import { legendDisplayName } from "@openrift/shared/utils";
import { ArrowLeftRightIcon, SearchIcon, StoreIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardThumbnail } from "@/features/cards/components/card-thumbnail";
import { useCardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { SourceAvatars } from "@/features/groups/components/source-avatars";
import {
  HiddenSuggestions,
  PeopleFilter,
  PersonActions,
} from "@/features/groups/components/trade-market-filters";
import type { TradeMarketSelection } from "@/features/groups/components/trade-market-sheet";
import { TradeMarketSheet } from "@/features/groups/components/trade-market-sheet";
import { useTradeMarket } from "@/features/groups/hooks/use-trade-market";
import { useWantedCards } from "@/features/groups/hooks/use-wanted-cards";
import { cartFor, cartItemForWanted } from "@/features/groups/lib/buy-cart";
import type { TradeMarketCard } from "@/features/groups/lib/trade-market";
import {
  filterMarketByGroup,
  filterMarketByPerson,
  marketPeople,
  sortByValue,
} from "@/features/groups/lib/trade-market";
import type { WantedCard } from "@/features/groups/lib/wanted-cards";
import { wantedMatchesPrinting } from "@/features/groups/lib/wanted-cards";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { useRequiredUserId } from "@/lib/auth-session";
import { formatterForMarketplace } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

type MarketTab = "get" | "give" | "swap" | "buy";

const ALL_GROUPS = "all";
const GRID =
  "grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7";
// Must mirror GRID's breakpoints.
const GRID_SIZES =
  "(min-width: 1280px) calc(100vw / 7), (min-width: 1024px) calc(100vw / 6), (min-width: 768px) calc(100vw / 4), (min-width: 640px) calc(100vw / 3), 50vw";
const BADGE_POSITION = "pointer-events-none absolute bottom-1.5 left-1.5 z-30";

function whoLine(card: TradeMarketCard): string {
  const [first] = card.sources;
  const count = card.sources.length;
  if (count === 1 && first !== undefined) {
    const name = first.name ?? m.trades_member_fallback();
    return card.direction === "incoming"
      ? m.trades_market_one_has({ name })
      : m.trades_market_one_wants({ name });
  }
  return card.direction === "incoming"
    ? m.trades_market_many_have({ count })
    : m.trades_market_many_want({ count });
}

function EmptyTab({ tab, searching }: { tab: MarketTab; searching: boolean }) {
  if (searching) {
    return <p className="text-muted-foreground py-6">{m.trades_market_no_match()}</p>;
  }
  const text = {
    get: m.trades_market_empty_get(),
    give: m.trades_market_empty_give(),
    swap: m.trades_market_empty_swap(),
    buy: m.trades_market_empty_buy(),
  }[tab];
  return <p className="text-muted-foreground py-6">{text}</p>;
}

export function TradeMarket() {
  const userId = useRequiredUserId();
  const { printingsById, printingsByCardId } = useCards();
  const prices = usePrices();
  const display = useCardThumbnailDisplay();
  const showImages = useDisplayStore((s) => s.showImages);
  const formatPrice = formatterForMarketplace("cardtrader");
  const priceOf = (printingId: string): string | null => {
    const value = prices.get(printingId, "cardtrader");
    return value === undefined ? null : formatPrice(value);
  };
  const nameOf = (printingId: string): string => {
    const printing = printingsById[printingId];
    return printing === undefined ? "" : legendDisplayName(printing.card);
  };

  const { market, groups, marketGroups, dismissals } = useTradeMarket();
  const [tab, setTab] = useState<MarketTab>("get");
  const [groupSlug, setGroupSlug] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<TradeMarketSelection | null>(null);
  const { wanted, ready: wantedReady } = useWantedCards(tab === "buy" || selection !== null);

  const cartItems = useBuyCartStore((state) => cartFor(state.carts, userId).items);
  const addItems = useBuyCartStore((state) => state.addItems);
  const removeItems = useBuyCartStore((state) => state.removeItems);
  const cartKeys = new Set(cartItems.map((item) => item.key));

  const shownPrintingId = (item: WantedCard): string | undefined =>
    item.printingId ?? printingsByCardId.get(item.cardId)?.[0]?.id;
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

  const people = marketPeople(market);
  const person = people.find((entry) => entry.userId === personId);
  const incoming = filterMarketByPerson(
    filterMarketByGroup(market.incoming, groupSlug),
    person?.userId ?? null,
  );
  const outgoing = filterMarketByPerson(
    filterMarketByGroup(market.outgoing, groupSlug),
    person?.userId ?? null,
  );
  const swaps = incoming.filter((card) => card.swapUserIds.length > 0);
  const buyable = wanted.filter(
    (item) =>
      !market.incoming.some((card) => wantedMatchesPrinting(item, card.cardId, card.printingId)),
  );

  const matchesQuery = (printingId: string | undefined) =>
    query.trim().length === 0 || matchesCardQuery(query, [printingId ? nameOf(printingId) : ""]);
  const byValue = <T,>(items: readonly T[], printingOf: (item: T) => string | undefined) =>
    sortByValue(
      items.filter((item) => matchesQuery(printingOf(item))),
      (item) => {
        const printingId = printingOf(item);
        return printingId === undefined
          ? undefined
          : prices.get(printingId, display.favoriteMarketplace);
      },
      (item) => {
        const printingId = printingOf(item);
        return printingId === undefined ? "" : nameOf(printingId);
      },
    );

  const marketCards = byValue(
    tab === "give" ? outgoing : tab === "swap" ? swaps : incoming,
    (card) => card.printingId,
  );
  const buyCards = byValue(buyable, shownPrintingId);

  const tabs: { value: MarketTab; label: string; count: number | null }[] = [
    { value: "get", label: m.trades_market_tab_get(), count: incoming.length },
    { value: "give", label: m.trades_market_tab_give(), count: outgoing.length },
    { value: "swap", label: m.trades_market_tab_swap(), count: swaps.length },
    { value: "buy", label: m.trades_market_tab_buy(), count: wantedReady ? buyable.length : null },
  ];
  const groupItems = [
    { value: ALL_GROUPS, label: m.trades_market_all_groups() },
    ...groups.map((group) => ({ value: group.slug, label: group.name })),
  ];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading icon={StoreIcon} tone="success">
        {m.trades_market_heading()}
      </SectionHeading>
      <Tabs className="gap-4" value={tab} onValueChange={(value) => setTab(value as MarketTab)}>
        <TabsList variant="line" className="h-auto flex-wrap justify-start">
          {tabs.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value} className="flex-none">
              {entry.label}
              {entry.count === null ? null : (
                <span className="text-muted-foreground tabular-nums">{entry.count}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={m.trades_market_search_placeholder()}
              aria-label={m.trades_market_search_placeholder()}
            />
          </InputGroup>
          {tab === "buy" || groups.length < 2 ? null : (
            <Select
              items={groupItems}
              value={groupSlug ?? ALL_GROUPS}
              onValueChange={(value) =>
                setGroupSlug(value === ALL_GROUPS || value === null ? null : value)
              }
            >
              <SelectTrigger className="w-full sm:w-56" aria-label={m.trades_market_group_filter()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groupItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {tab === "buy" ? null : (
          <PeopleFilter
            people={people}
            personId={person?.userId ?? null}
            onPersonChange={setPersonId}
          />
        )}
        {tab === "buy" || person === undefined ? null : (
          <PersonActions market={market} person={person} />
        )}

        <TabsContent value={tab}>
          {tab === "buy" ? (
            wantedReady && buyCards.length === 0 ? (
              <EmptyTab tab={tab} searching={query.trim().length > 0} />
            ) : (
              <div className={GRID}>
                {buyCards.map((item) => {
                  const printingId = shownPrintingId(item);
                  const printing = printingId === undefined ? undefined : printingsById[printingId];
                  if (printing === undefined) {
                    return null;
                  }
                  const inCart = cartKeys.has(item.key);
                  return (
                    <CardThumbnail
                      key={item.key}
                      printing={printing}
                      showImages={showImages}
                      display={display}
                      sizes={GRID_SIZES}
                      view="printings"
                      imageOverlay={
                        inCart ? (
                          <Badge variant="secondary" className={BADGE_POSITION}>
                            {m.trades_market_in_cart()}
                          </Badge>
                        ) : undefined
                      }
                      selected={selection?.kind === "wanted" && selection.wanted.key === item.key}
                      onClick={() =>
                        setSelection({ kind: "wanted", wanted: item, printingId: printing.id })
                      }
                      belowLabel={
                        <span className="text-muted-foreground mt-1 block px-1.5 text-sm">
                          {m.trades_market_want_count({ count: item.quantity })}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )
          ) : marketCards.length === 0 ? (
            <EmptyTab tab={tab} searching={query.trim().length > 0} />
          ) : (
            <div className={GRID}>
              {marketCards.map((card) => {
                const printing = printingsById[card.printingId];
                if (printing === undefined) {
                  return null;
                }
                return (
                  <CardThumbnail
                    key={`${card.direction}:${card.printingId}`}
                    printing={printing}
                    showImages={showImages}
                    display={display}
                    sizes={GRID_SIZES}
                    view="printings"
                    imageOverlay={
                      tab !== "swap" && card.swapUserIds.length > 0 ? (
                        <Badge
                          className={cn("bg-success text-success-foreground gap-1", BADGE_POSITION)}
                        >
                          <ArrowLeftRightIcon />
                          {m.trades_market_swap_badge()}
                        </Badge>
                      ) : undefined
                    }
                    selected={
                      selection?.kind === "market" &&
                      selection.card.printingId === card.printingId &&
                      selection.card.direction === card.direction
                    }
                    onClick={() => setSelection({ kind: "market", card })}
                    belowLabel={
                      <span className="text-muted-foreground mt-1 flex min-w-0 items-center gap-2 px-1.5 text-sm">
                        <SourceAvatars sources={card.sources} />
                        <span className="truncate">{whoLine(card)}</span>
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <HiddenSuggestions dismissals={dismissals} groups={marketGroups} />

      <TradeMarketSheet
        selection={selection}
        onClose={() => setSelection(null)}
        wantedForCard={wantedForCard}
        cartKeys={cartKeys}
        onToggleCart={toggleCart}
        priceOf={priceOf}
      />
    </section>
  );
}
