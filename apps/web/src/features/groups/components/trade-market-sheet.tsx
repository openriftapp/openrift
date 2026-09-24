import { enumLabel } from "@openrift/shared/enum-label";
import type { Printing } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRightIcon, CheckIcon, EyeOffIcon, ShoppingCartIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TextLink } from "@/components/ui/text-link";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { useCards } from "@/features/cards/hooks/use-cards";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { MatchTradeList } from "@/features/groups/components/match-row-card";
import { useDismissSuggestions } from "@/features/groups/hooks/use-trade-dismissals";
import type { TradeMarketCard } from "@/features/groups/lib/trade-market";
import type { WantedCard } from "@/features/groups/lib/wanted-cards";
import { useEnumOrders } from "@/hooks/use-enums";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export type TradeMarketSelection =
  | { kind: "market"; card: TradeMarketCard }
  | { kind: "wanted"; wanted: WantedCard; printingId: string };

function distinct(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function SheetCardHeader({
  printing,
  price,
  listLine,
}: {
  printing: Printing;
  price: string | null;
  listLine: string | null;
}) {
  const { sets } = useCards();
  const { labels } = useEnumOrders();
  const name = legendDisplayName(printing.card);
  const setName = sets.find((set) => set.id === printing.setId)?.name ?? printing.setId;
  return (
    <SheetHeader className="flex-row gap-4 pr-12">
      <CardArtThumb
        imageId={frontImageId(printing)}
        alt={name}
        rarity={printing.rarity}
        domains={printing.card.domains}
        className="w-24 shrink-0 rounded-md"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <SheetTitle className="text-lg">{name}</SheetTitle>
        <SheetDescription>
          {[
            setName,
            enumLabel(labels.rarities, printing.rarity),
            enumLabel(labels.finishes, printing.finish),
          ].join(" · ")}
        </SheetDescription>
        {price === null ? null : (
          <p className="text-muted-foreground text-sm">
            {m.trades_market_cardtrader_estimate({ price })}
          </p>
        )}
        {listLine === null ? null : <p className="text-muted-foreground text-sm">{listLine}</p>}
      </div>
    </SheetHeader>
  );
}

function DismissSources({ card, onClose }: { card: TradeMarketCard; onClose: () => void }) {
  const dismiss = useDismissSuggestions();
  return (
    <div className="flex flex-col gap-1">
      {card.sources.map((source) => {
        const name = source.name ?? m.trades_member_fallback();
        return (
          <Button
            key={source.userId}
            size="sm"
            variant="ghost"
            className="text-muted-foreground self-start"
            disabled={dismiss.isPending}
            onClick={() => {
              dismiss.mutate([
                {
                  direction: card.direction,
                  counterpartyUserId: source.userId,
                  printingId: card.printingId,
                },
              ]);
              if (card.sources.length === 1) {
                onClose();
              }
            }}
          >
            <EyeOffIcon />
            {m.trades_market_hide_one({ name })}
          </Button>
        );
      })}
    </div>
  );
}

function SwapHints({ card }: { card: TradeMarketCard }) {
  if (card.swapUserIds.length === 0) {
    return null;
  }
  const partners = card.sources.filter((source) => card.swapUserIds.includes(source.userId));
  return (
    <div className="flex flex-col gap-2">
      {partners.map((partner) => {
        const name = partner.name ?? m.trades_member_fallback();
        return (
          <Callout key={partner.userId} className="flex flex-col gap-3">
            <p className="flex items-center gap-2 font-medium">
              <ArrowLeftRightIcon className="text-success size-4 shrink-0" />
              {card.direction === "incoming"
                ? m.trades_market_swap_wants_yours({ name })
                : m.trades_market_swap_has_yours({ name })}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              render={
                <Link
                  to="/trades/$userId"
                  params={{ userId: partner.userId }}
                  search={{ from: undefined }}
                />
              }
            >
              {m.trades_market_open_sheet({ name })}
            </Button>
          </Callout>
        );
      })}
    </div>
  );
}

function BuyRow({
  wanted,
  hasSources,
  inCart,
  onToggleCart,
}: {
  wanted: WantedCard;
  hasSources: boolean;
  inCart: boolean;
  onToggleCart: (wanted: WantedCard) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <p className="text-muted-foreground text-sm">
        {hasSources ? m.trades_market_or_buy() : m.trades_market_buy_it()}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={inCart ? "outline" : "default"}
          onClick={() => onToggleCart(wanted)}
        >
          {inCart ? <CheckIcon /> : <ShoppingCartIcon />}
          {inCart ? m.trades_market_in_cart() : m.trades_market_add_to_cart()}
        </Button>
        <TextLink render={<Link to="/trades/buy" />}>{m.trades_market_view_cart()}</TextLink>
      </div>
    </div>
  );
}

export function TradeMarketSheet({
  selection,
  onClose,
  wantedForCard,
  cartKeys,
  onToggleCart,
  priceOf,
}: {
  selection: TradeMarketSelection | null;
  onClose: () => void;
  wantedForCard: (card: TradeMarketCard) => WantedCard | undefined;
  cartKeys: ReadonlySet<string>;
  onToggleCart: (wanted: WantedCard) => void;
  priceOf: (printingId: string) => string | null;
}) {
  const isMobile = useIsMobile();
  const { printingsById } = useCards();

  const printingId =
    selection === null
      ? null
      : selection.kind === "market"
        ? selection.card.printingId
        : selection.printingId;
  const printing = printingId === null ? undefined : printingsById[printingId];
  const card = selection?.kind === "market" ? selection.card : null;
  const wanted =
    selection === null
      ? undefined
      : selection.kind === "market"
        ? card?.direction === "incoming"
          ? wantedForCard(selection.card)
          : undefined
        : selection.wanted;

  const listNames =
    card === null
      ? (wanted?.listNames ?? [])
      : distinct(card.rows.map((row) => row.viewerListName));
  const listLine =
    listNames.length === 0
      ? null
      : card?.direction === "outgoing"
        ? m.trades_market_on_tradelists({ lists: listNames.join(", ") })
        : m.trades_market_on_wishlists({ lists: listNames.join(", ") });

  return (
    <Sheet
      open={selection !== null && printing !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("overflow-y-auto", isMobile ? "max-h-[85dvh]" : "sm:max-w-md")}
      >
        {printing === undefined ? null : (
          <>
            <SheetCardHeader printing={printing} price={priceOf(printing.id)} listLine={listLine} />
            <div className="flex flex-col gap-5 px-4 pb-6">
              {card === null ? (
                <p>{m.trades_market_no_source()}</p>
              ) : (
                <section className="flex flex-col gap-3">
                  <SectionHeading as="h3" count={card.sources.length}>
                    {card.direction === "incoming"
                      ? m.trades_market_sources()
                      : m.trades_market_wanted_by()}
                  </SectionHeading>
                  <MatchTradeList
                    incoming={card.direction === "incoming" ? card.rows : []}
                    outgoing={card.direction === "outgoing" ? card.rows : []}
                    groupSlug={card.rows[0]?.groupSlug ?? ""}
                  />
                </section>
              )}
              {card === null ? null : <DismissSources card={card} onClose={onClose} />}
              {card === null ? null : <SwapHints card={card} />}
              {wanted === undefined ? null : (
                <BuyRow
                  wanted={wanted}
                  hasSources={card !== null}
                  inCart={cartKeys.has(wanted.key)}
                  onToggleCart={onToggleCart}
                />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
