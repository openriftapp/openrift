import { enumLabel } from "@openrift/shared/enum-label";
import {
  CARDMARKET_WANTS_URL,
  CARDTRADER_WISHLIST_URL,
  tcgplayerMassEntryUrl,
} from "@openrift/shared/marketplace";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { legendDisplayName } from "@openrift/shared/utils";
import { Link } from "@tanstack/react-router";
import { CheckIcon, PuzzleIcon, ShoppingCartIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MarketplaceLink } from "@/components/marketplace-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TextLink } from "@/components/ui/text-link";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useMarketplaceInfo } from "@/features/cards/hooks/use-marketplace-info";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { useMarkOrdered } from "@/features/groups/hooks/use-mark-ordered";
import type { BuyCartItem } from "@/features/groups/lib/buy-cart";
import { cartCardLines, cartTotal, massEntryLines } from "@/features/groups/lib/buy-cart";
import type { WantedCard } from "@/features/groups/lib/wanted-cards";
import { useBuyCartStore } from "@/features/groups/stores/buy-cart-store";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useEnumOrders } from "@/hooks/use-enums";
import { formatCardmarketWants, formatCardtraderWishlist } from "@/lib/export-text";
import { formatterForMarketplace } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const MARKETPLACE_ORDER: readonly Marketplace[] = ["cardtrader", "cardmarket", "tcgplayer"];

function marketplaceName(marketplace: Marketplace): string {
  return {
    cardtrader: m.trades_buy_market_cardtrader(),
    cardmarket: m.trades_buy_market_cardmarket(),
    tcgplayer: m.trades_buy_market_tcgplayer(),
  }[marketplace];
}

function marketplaceHow(marketplace: Marketplace): string {
  return {
    cardtrader: m.trades_buy_how_cardtrader(),
    cardmarket: m.trades_buy_how_cardmarket(),
    tcgplayer: m.trades_buy_how_tcgplayer(),
  }[marketplace];
}

function PrintingPicker({
  item,
  name,
  priceOf,
  onPrintingChange,
}: {
  item: BuyCartItem;
  name: string;
  priceOf: (printingId: string) => string | null;
  onPrintingChange: (printingId: string) => void;
}) {
  const { printingsByCardId } = useCards();
  const { labels } = useEnumOrders();
  const printings = printingsByCardId.get(item.cardId) ?? [];
  if (!item.key.startsWith("card:") || printings.length < 2) {
    return null;
  }
  const items = printings.map((printing) => {
    const price = priceOf(printing.id);
    return {
      value: printing.id,
      label: [
        printing.shortCode,
        enumLabel(labels.finishes, printing.finish),
        printing.language,
        ...(price === null ? [] : [price]),
      ].join(" · "),
    };
  });
  return (
    <Select
      items={items}
      value={item.printingId}
      onValueChange={(value) => {
        if (value !== null) {
          onPrintingChange(value);
        }
      }}
    >
      <SelectTrigger size="sm" className="w-full" aria-label={m.trades_buy_printing({ name })}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((entry) => (
          <SelectItem key={entry.value} value={entry.value}>
            {entry.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CartRow({
  item,
  price,
  priceOf,
  onRemove,
  onPrintingChange,
}: {
  item: BuyCartItem;
  price: string | null;
  priceOf: (printingId: string) => string | null;
  onRemove: () => void;
  onPrintingChange: (printingId: string) => void;
}) {
  const { printingsById } = useCards();
  const printing = printingsById[item.printingId];
  const name = printing === undefined ? "" : legendDisplayName(printing.card);
  return (
    <li className="flex items-center gap-3 border-b py-2 last:border-b-0">
      <CardArtThumb imageId={frontImageId(printing)} alt="" className="w-7 shrink-0 rounded-sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate">
          {item.quantity > 1 ? `${item.quantity}× ` : ""}
          {name}
        </span>
        <PrintingPicker
          item={item}
          name={name}
          priceOf={priceOf}
          onPrintingChange={onPrintingChange}
        />
      </span>
      {price === null ? null : (
        <span className="text-muted-foreground text-sm tabular-nums">{price}</span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={m.trades_buy_remove({ name })}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </li>
  );
}

function HandoffButton({
  marketplace,
  items,
  nameOf,
}: {
  marketplace: Marketplace;
  items: readonly BuyCartItem[];
  nameOf: (item: BuyCartItem) => string;
}) {
  const { copy } = useCopyToClipboard();
  const { data: marketplaceInfo } = useMarketplaceInfo(
    marketplace === "tcgplayer" ? items.map((item) => item.printingId) : [],
  );
  const lines = cartCardLines(items, nameOf);
  const className = cn(buttonVariants(), "w-full");

  if (marketplace === "tcgplayer") {
    const { lines: massEntry, unlisted } = massEntryLines(
      items,
      (printingId) => marketplaceInfo?.infos[printingId]?.tcgplayer.productId,
    );
    if (marketplaceInfo === undefined || massEntry.length === 0) {
      return (
        <>
          <Button className="w-full" disabled>
            <ShoppingCartIcon />
            {m.trades_buy_cta_tcgplayer()}
          </Button>
          {marketplaceInfo === undefined ? null : (
            <p className="text-muted-foreground text-sm">
              {m.trades_buy_tcgplayer_unlisted({ count: unlisted.length })}
            </p>
          )}
        </>
      );
    }
    return (
      <>
        <MarketplaceLink
          marketplace="tcgplayer"
          href={tcgplayerMassEntryUrl(massEntry)}
          className={className}
        >
          <ShoppingCartIcon />
          {m.trades_buy_cta_tcgplayer()}
        </MarketplaceLink>
        {unlisted.length > 0 ? (
          <p className="text-muted-foreground text-sm">
            {m.trades_buy_tcgplayer_unlisted({ count: unlisted.length })}
          </p>
        ) : null}
      </>
    );
  }

  const text =
    marketplace === "cardmarket" ? formatCardmarketWants(lines) : formatCardtraderWishlist(lines);
  const copyList = async () => {
    const copied = await copy(text);
    if (copied) {
      toast.success(m.trades_buy_list_copied());
    } else {
      toast.error(m.trades_buy_copy_failed());
    }
  };
  return (
    <>
      <MarketplaceLink
        marketplace={marketplace}
        href={marketplace === "cardmarket" ? CARDMARKET_WANTS_URL : CARDTRADER_WISHLIST_URL}
        className={className}
        onClick={() => void copyList()}
      >
        <ShoppingCartIcon />
        {marketplace === "cardmarket"
          ? m.trades_buy_cta_cardmarket()
          : m.trades_buy_cta_cardtrader()}
      </MarketplaceLink>
      <p className="text-muted-foreground text-sm">
        {marketplace === "cardmarket"
          ? m.trades_buy_note_cardmarket()
          : m.trades_buy_note_cardtrader()}{" "}
        <Button
          variant="link"
          className="h-auto p-0 align-baseline"
          onClick={() => void copyList()}
        >
          {m.trades_buy_copy_again()}
        </Button>
      </p>
    </>
  );
}

function ExtensionTip() {
  return (
    <Callout variant="inset" className="flex gap-3">
      <PuzzleIcon className="text-info mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{m.trades_buy_extension_title()}</p>
        <p className="text-muted-foreground text-sm">{m.trades_buy_extension_body()}</p>
        <TextLink
          className="self-start text-sm"
          render={<Link to="/help/$slug" params={{ slug: "browser-extension" }} />}
        >
          {m.trades_buy_extension_link()}
        </TextLink>
      </div>
    </Callout>
  );
}

export function BuyCartPanel({
  userId,
  items,
  wantedByKey,
  wantedReady,
}: {
  userId: string;
  items: readonly BuyCartItem[];
  wantedByKey: ReadonlyMap<string, WantedCard>;
  wantedReady: boolean;
}) {
  const { printingsById } = useCards();
  const prices = usePrices();
  const formatPrice = formatterForMarketplace("cardtrader");
  const marketplace = useBuyCartStore((state) => state.marketplace);
  const setMarketplace = useBuyCartStore((state) => state.setMarketplace);
  const removeItems = useBuyCartStore((state) => state.removeItems);
  const setPrinting = useBuyCartStore((state) => state.setPrinting);
  const clear = useBuyCartStore((state) => state.clear);
  const { markOrdered, pending, orderedCollection, ready } = useMarkOrdered();
  const [filed, setFiled] = useState<number | null>(null);

  const priceValue = (printingId: string) => prices.get(printingId, "cardtrader");
  const priceOf = (printingId: string): string | null => {
    const value = priceValue(printingId);
    return value === undefined ? null : formatPrice(value);
  };
  const nameOf = (item: BuyCartItem): string => {
    const printing = printingsById[item.printingId];
    return printing === undefined ? "" : legendDisplayName(printing.card);
  };
  const { total, unpriced } = cartTotal(items, priceValue);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  const fileOrder = async () => {
    const done = await markOrdered(items, wantedByKey);
    if (done) {
      setFiled(count);
      clear(userId);
    }
  };

  return (
    <aside
      id="cart"
      aria-label={m.trades_buy_cart_title()}
      className="bg-card flex flex-col gap-5 rounded-xl border p-4 lg:sticky lg:top-[calc(var(--header-height)+5rem)]"
    >
      <div className="flex items-center gap-2">
        <ShoppingCartIcon className="size-5" />
        <h2 className="font-heading flex-1 text-lg font-medium">{m.trades_buy_cart_title()}</h2>
        <span className="text-muted-foreground text-sm">{m.common_cards({ count })}</span>
      </div>

      {filed === null ? null : (
        <Callout className="bg-success-soft flex flex-col gap-2 border-transparent">
          <p className="text-success flex items-center gap-2 font-medium">
            <CheckIcon className="size-4" />
            {m.trades_buy_filed_title({
              count: filed,
              collection: orderedCollection?.name ?? m.trades_buy_ordered_collection_name(),
            })}
          </p>
          <p className="text-sm">{m.trades_buy_filed_body()}</p>
          {orderedCollection === undefined ? null : (
            <TextLink
              className="self-start text-sm"
              render={
                <Link
                  to="/collections/$collectionId"
                  params={{ collectionId: orderedCollection.id }}
                />
              }
            >
              {m.trades_buy_open_collection()}
            </TextLink>
          )}
        </Callout>
      )}

      {items.length === 0 ? (
        filed === null ? (
          <p className="text-muted-foreground">{m.trades_buy_cart_empty()}</p>
        ) : null
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col">
              {items.map((item) => (
                <CartRow
                  key={item.key}
                  item={item}
                  price={priceOf(item.printingId)}
                  priceOf={priceOf}
                  onRemove={() => removeItems(userId, [item.key])}
                  onPrintingChange={(printingId) => setPrinting(userId, item.key, printingId)}
                />
              ))}
            </ul>
            <div className="flex items-baseline justify-between gap-3">
              <span>{m.trades_buy_estimate_label()}</span>
              <span className="font-medium tabular-nums">{formatPrice(total)}</span>
            </div>
            {unpriced > 0 ? (
              <p className="text-muted-foreground text-sm">
                {m.trades_buy_unpriced({ count: unpriced })}
              </p>
            ) : null}
          </div>

          <RadioGroup
            value={marketplace}
            onValueChange={(value) => setMarketplace(value as Marketplace)}
            aria-label={m.trades_buy_market_label()}
          >
            {MARKETPLACE_ORDER.map((entry) => (
              // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- the radio control is nested inside the label
              <label
                key={entry}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                  marketplace === entry && "border-primary bg-primary/5",
                )}
              >
                <RadioGroupItem value={entry} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{marketplaceName(entry)}</span>
                  <span className="text-muted-foreground text-sm">{marketplaceHow(entry)}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          <div className="flex flex-col gap-2">
            <HandoffButton marketplace={marketplace} items={items} nameOf={nameOf} />
          </div>

          {marketplace === "cardmarket" ? <ExtensionTip /> : null}

          <div className="flex flex-col gap-2 border-t pt-4">
            <p className="font-medium">{m.trades_buy_ordered_title()}</p>
            <p className="text-muted-foreground text-sm">
              {m.trades_buy_ordered_body({
                collection: orderedCollection?.name ?? m.trades_buy_ordered_collection_name(),
              })}
            </p>
            <Button
              variant="outline"
              disabled={pending || !ready || !wantedReady}
              onClick={() => void fileOrder()}
            >
              {m.trades_buy_ordered_cta({ count })}
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
