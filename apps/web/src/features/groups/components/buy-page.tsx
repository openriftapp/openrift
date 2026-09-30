import { legendDisplayName } from "@openrift/shared/utils";
import { Link } from "@tanstack/react-router";
import { PackageIcon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageDescription, PageTopBar, PageTopBarSticky } from "@/components/layout/page-top-bar";
import { TopBarBreadcrumbTrail } from "@/components/layout/top-bar-breadcrumb";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { IconChip } from "@/components/ui/icon-chip";
import { SelectionMark } from "@/components/ui/selection-mark";
import { TextLink } from "@/components/ui/text-link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CardThumbnail } from "@/features/cards/components/card-thumbnail";
import { useCardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { useCopies } from "@/features/collections/hooks/use-copies";
import { BuyCartPanel } from "@/features/groups/components/buy-cart-panel";
import { useMarkOrdered } from "@/features/groups/hooks/use-mark-ordered";
import { useTradeMarket } from "@/features/groups/hooks/use-trade-market";
import { useWantedCards } from "@/features/groups/hooks/use-wanted-cards";
import type { BuyCartItem } from "@/features/groups/lib/buy-cart";
import { cartFor, cartItemForWanted } from "@/features/groups/lib/buy-cart";
import { sortByValue } from "@/features/groups/lib/trade-market";
import type { WantedCard } from "@/features/groups/lib/wanted-cards";
import { wantedMatchesPrinting } from "@/features/groups/lib/wanted-cards";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { useRequiredUserId } from "@/lib/auth-session";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

type BuyFilter = "none" | "friends" | "all";

// Must mirror the grid's breakpoints; the cart panel takes 22rem from lg up.
const GRID_SIZES =
  "(min-width: 1280px) calc((100vw - 22rem) / 5), (min-width: 1024px) calc((100vw - 22rem) / 4), (min-width: 768px) calc(100vw / 4), (min-width: 640px) calc(100vw / 3), 50vw";

function OrderedCallout({ collectionId, name }: { collectionId: string; name: string }) {
  const { data: copies } = useCopies(collectionId);
  if (copies.length === 0) {
    return null;
  }
  return (
    <Callout className="flex flex-wrap items-center gap-3">
      <IconChip icon={PackageIcon} tone="gold" size="sm" shape="round" />
      <p className="min-w-0 flex-1">
        {m.trades_buy_ordered_waiting({ count: copies.length, collection: name })}
      </p>
      <TextLink render={<Link to="/collections/$collectionId" params={{ collectionId }} />}>
        {m.trades_buy_open_collection()}
      </TextLink>
    </Callout>
  );
}

export function BuyPage() {
  const userId = useRequiredUserId();
  const { printingsById, printingsByCardId } = useCards();
  const prices = usePrices();
  const display = useCardThumbnailDisplay();
  const showImages = useDisplayStore((s) => s.showImages);
  const { market } = useTradeMarket();
  const { wanted, ready } = useWantedCards(true);
  const { orderedCollection } = useMarkOrdered();
  const items = useBuyCartStore((state) => cartFor(state.carts, userId).items);
  const addItems = useBuyCartStore((state) => state.addItems);
  const removeItems = useBuyCartStore((state) => state.removeItems);
  const [filter, setFilter] = useState<BuyFilter>("none");

  const cartKeys = new Set(items.map((item) => item.key));
  const wantedByKey = new Map(wanted.map((item) => [item.key, item]));
  const shownPrintingId = (item: WantedCard): string | undefined =>
    item.printingId ?? printingsByCardId.get(item.cardId)?.[0]?.id;
  const priceValue = (printingId: string | undefined) =>
    printingId === undefined ? undefined : prices.get(printingId, display.favoriteMarketplace);
  const nameOf = (item: WantedCard): string => {
    const printingId = shownPrintingId(item);
    const printing = printingId === undefined ? undefined : printingsById[printingId];
    return printing === undefined ? "" : legendDisplayName(printing.card);
  };
  const friendsHave = (item: WantedCard) =>
    market.incoming.some((card) => wantedMatchesPrinting(item, card.cardId, card.printingId));

  const noSource = wanted.filter((item) => !friendsHave(item));
  const withSource = wanted.filter((item) => friendsHave(item));
  const shown = sortByValue(
    { none: noSource, friends: withSource, all: wanted }[filter],
    (item) => priceValue(shownPrintingId(item)),
    nameOf,
  );
  const shownItems = shown.flatMap((item): BuyCartItem[] => {
    const cartItem = cartItemForWanted(item, shownPrintingId(item));
    return cartItem === null ? [] : [cartItem];
  });
  const allShownInCart =
    shownItems.length > 0 && shownItems.every((item) => cartKeys.has(item.key));

  const toggle = (item: WantedCard) => {
    if (cartKeys.has(item.key)) {
      removeItems(userId, [item.key]);
      return;
    }
    const cartItem = cartItemForWanted(item, shownPrintingId(item));
    if (cartItem !== null) {
      addItems(userId, [cartItem]);
    }
  };

  const filters: { value: BuyFilter; label: string; count: number }[] = [
    { value: "none", label: m.trades_buy_filter_none(), count: noSource.length },
    { value: "friends", label: m.trades_buy_filter_friends(), count: withSource.length },
    { value: "all", label: m.trades_buy_filter_all(), count: wanted.length },
  ];

  return (
    <>
      <PageTopBarSticky width="full">
        <PageTopBar className="gap-2">
          <TopBarBreadcrumbTrail
            segments={[
              { label: m.trades_title(), link: <Link to="/trades" /> },
              { label: m.trades_buy_title() },
            ]}
          />
        </PageTopBar>
      </PageTopBarSticky>

      <div
        className={cn(
          PAGE_WIDTH.full,
          "px-safe grid gap-8 pt-3 pb-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start",
        )}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <PageDescription>{m.trades_buy_description()}</PageDescription>

          {orderedCollection === undefined ? null : (
            <OrderedCallout collectionId={orderedCollection.id} name={orderedCollection.name} />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              value={[filter]}
              onValueChange={(value) => {
                const [next] = value;
                if (next !== undefined) {
                  setFilter(next as BuyFilter);
                }
              }}
              className="flex-wrap"
            >
              {filters.map((entry) => (
                <ToggleGroupItem key={entry.value} value={entry.value}>
                  {entry.label}
                  <span className="text-muted-foreground tabular-nums">{entry.count}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span className="flex-1" />
            {shownItems.length === 0 ? null : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  allShownInCart
                    ? removeItems(
                        userId,
                        shownItems.map((item) => item.key),
                      )
                    : addItems(userId, shownItems)
                }
              >
                {allShownInCart ? m.trades_buy_remove_shown() : m.trades_buy_add_shown()}
              </Button>
            )}
          </div>

          {ready && wanted.length === 0 ? (
            <EmptyState
              icon={PackageIcon}
              title={m.trades_buy_empty_title()}
              description={m.trades_buy_empty_description()}
            >
              <Button render={<Link to="/collections" />}>{m.trades_buy_empty_cta()}</Button>
            </EmptyState>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground py-6">{m.trades_buy_filter_empty()}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {shown.map((item) => {
                const printingId = shownPrintingId(item);
                const printing = printingId === undefined ? undefined : printingsById[printingId];
                if (printing === undefined) {
                  return null;
                }
                const name = legendDisplayName(printing.card);
                const inCart = cartKeys.has(item.key);
                return (
                  <CardThumbnail
                    key={item.key}
                    printing={printing}
                    showImages={showImages}
                    display={display}
                    sizes={GRID_SIZES}
                    view="printings"
                    selected={inCart}
                    onClick={() => toggle(item)}
                    imageOverlay={
                      <SelectionMark
                        label={inCart ? m.trades_buy_remove({ name }) : m.trades_buy_add({ name })}
                        checked={inCart}
                        onCheckedChange={() => toggle(item)}
                      />
                    }
                    belowLabel={
                      <span className="text-muted-foreground mt-1 block truncate px-1.5 text-sm">
                        {item.quantity > 1
                          ? m.trades_market_want_count({ count: item.quantity })
                          : null}
                        {item.quantity > 1 ? " · " : null}
                        {friendsHave(item)
                          ? m.trades_buy_source_friends()
                          : m.trades_buy_source_none()}
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        <BuyCartPanel userId={userId} items={items} wantedByKey={wantedByKey} wantedReady={ready} />
      </div>
    </>
  );
}
