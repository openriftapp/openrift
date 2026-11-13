import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { sideKey } from "@openrift/shared/printing-side";
import { setIndexById, UNKNOWN_SET_INDEX } from "@openrift/shared/set-order";
import type { CardTradeResponse, CardTradeStatus } from "@openrift/shared/types/api/card-trade";
import type { FriendGroupMatchRow } from "@openrift/shared/types/api/friend-group";
import type { MarketplaceLink } from "@openrift/shared/types/api/pricing";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { EyeOffIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { CountPill } from "@/components/ui/count-pill";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { CardDetailNameButton } from "@/features/cards/components/card-detail-opener";
import { PrintingHoverPreview } from "@/features/cards/components/printing-hover-preview";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useMarketplaceLinks } from "@/features/cards/hooks/use-marketplace-links";
import { usePrices } from "@/features/cards/hooks/use-prices";
import type { CatalogPosition } from "@/features/cards/lib/catalog-position";
import { compareCatalogPosition } from "@/features/cards/lib/catalog-position";
import { conditionShortCode } from "@/features/collections/lib/condition-codes";
import {
  MatchPreferenceCell,
  MatchPreferenceText,
} from "@/features/groups/components/match-preference-cell";
import { useCreateTrade, useUserTrades } from "@/features/groups/hooks/use-card-trades";
import { fixedPriceVsEstimate } from "@/features/groups/lib/price-vs-estimate";
import type { MatchCopyDetail, MatchDirection } from "@/features/groups/lib/trade-derivation";
import {
  describeCounterpartySource,
  describeViewerSource,
  matchCopyConditionLabel,
  matchSuggestionKey,
  maxTradeQuantity,
  groupMatchCopyConditions,
  liveTradeFor,
  liveTradeIndex,
  liveTradesForCard,
  summarizeMatchCopies,
} from "@/features/groups/lib/trade-derivation";
import { tradePrinting } from "@/features/groups/lib/trade-printing";
import { useMatchVariantsFoldStore } from "@/features/groups/stores/match-variants-fold-store";
import { useEnumOrders } from "@/hooks/use-enums";
import { useMouseHover } from "@/hooks/use-mouse-hover";
import {
  compactFormatterForMarketplace,
  formatterForMarketplace,
  priceColorClass,
} from "@/lib/format";
import { memberName } from "@/lib/member-name";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

import { AvailableCopiesPopover } from "./available-copies-popover";
import type { RequestableCopy } from "./request-trade-dialog";
import { RequestTradeDialog } from "./request-trade-dialog";
import {
  CardMetaLine,
  LiveTradesElsewhereLine,
  TradeDirectionIcon,
  TradePerCopyPrice,
  TradeStatusBadge,
} from "./trade-row-parts";

const DIRECTION_ORDER: Record<MatchDirection, number> = { incoming: 0, outgoing: 1 };

export type MatchTradeListRow = FriendGroupMatchRow & {
  groupSlug?: string;
  groupName?: string;
  liveOnly?: boolean;
};

function MatchRowTradeAction({
  match,
  liveTrade,
}: {
  match: DirectedMatch | PersonMatch;
  liveTrade?: CardTradeResponse;
}) {
  const [open, setOpen] = useState(false);
  const createTrade = useCreateTrade();
  const groupChoices: PersonMatch["groupChoices"] =
    "groupChoices" in match ? match.groupChoices : [match];
  const [chosenSlug, setChosenSlug] = useState(groupChoices[0].groupSlug);
  const choice = groupChoices.find((option) => option.groupSlug === chosenSlug) ?? groupChoices[0];
  const groupSlug = choice.groupSlug;

  if (liveTrade !== undefined) {
    return (
      <TradeStatusBadge
        status={liveTrade.status}
        awaitingViewer={liveTrade.actionNeeded === "accept-or-decline"}
        viewerSettled={liveTrade.viewerSyncAppliedAt !== null}
        className="min-w-0 shrink"
      />
    );
  }

  const incoming = match.direction === "incoming";
  const role = incoming ? "receiver" : "giver";

  return (
    <>
      <Button
        size="sm"
        className="shrink-0"
        disabled={createTrade.isPending || match.availableCount <= 0}
        onClick={() => setOpen(true)}
      >
        {incoming ? m.lists_share_request() : m.lists_share_offer()}
      </Button>
      <RequestTradeDialog
        open={open}
        onOpenChange={setOpen}
        mode={incoming ? "request" : "offer"}
        cardName={match.cardName}
        availableCount={choice.availableCount}
        demandQuantity={match.buyQuantity}
        pending={createTrade.isPending}
        copies={incoming ? choice.copies : undefined}
        groupPicker={
          groupChoices.length < 2
            ? undefined
            : {
                items: groupChoices.map((option) => ({
                  value: option.groupSlug,
                  label: `${option.groupName ?? option.groupSlug} · ${m.trades_market_person_available({ count: option.availableCount })}`,
                })),
                value: groupSlug,
                onChange: setChosenSlug,
              }
        }
        canExceedWish={incoming && match.buyEntryId !== null}
        onConfirm={(quantity, copyIds) => {
          createTrade.mutate(
            {
              groupSlug,
              counterpartyUserId: match.counterpartyUserId,
              role,
              printingId: match.printingId,
              cardId: match.cardId,
              quantity,
              copyIds,
            },
            { onSuccess: () => setOpen(false) },
          );
        }}
      />
    </>
  );
}

function MatchLiveTradesElsewhere({
  cardId,
  direction,
  shownTrades,
}: {
  cardId: string;
  direction: MatchDirection;
  shownTrades: readonly (CardTradeResponse | undefined)[];
}) {
  const { data: userTrades } = useUserTrades();
  const shownIds = shownTrades.flatMap((trade) => (trade === undefined ? [] : [trade.id]));
  return (
    <LiveTradesElsewhereLine
      trades={liveTradesForCard(userTrades?.items ?? [], cardId, direction, shownIds)}
    />
  );
}

interface ResolvedMatchRow extends FriendGroupMatchRow {
  groupSlug: string;
  groupName?: string;
  liveOnly?: boolean;
  cardSlug: string;
  shortCode: string;
  setIndex: number;
  setName: string;
  domains: string[];
  printing: Printing | null;
}

export interface AggregatedMatch extends ResolvedMatchRow {
  availableCount: number;
  copies: RequestableCopy[];
}

interface DirectedMatch extends AggregatedMatch {
  direction: MatchDirection;
}

export interface PersonMatch extends DirectedMatch {
  groupChoices: [DirectedMatch, ...DirectedMatch[]];
}

export function resolveMatchRows(
  rows: MatchTradeListRow[],
  cardsById: ReturnType<typeof useCards>["cardsById"],
  printingsById: ReturnType<typeof useCards>["printingsById"],
  sets: ReturnType<typeof useCards>["sets"],
  fallbackGroupSlug: string,
  printingsByCardId: ReturnType<typeof useCards>["printingsByCardId"],
): ResolvedMatchRow[] {
  const setsById = new Map(sets.map((set) => [set.id, set]));
  const setIndexes = setIndexById(sets);
  return rows.map((row) => {
    const card = cardsById[row.cardId];
    const set = setsById.get(row.setId);
    const printing = tradePrinting(row, printingsByCardId, printingsById) ?? null;
    const groupSlug = row.groupSlug ?? fallbackGroupSlug;
    return {
      ...row,
      groupSlug,
      cardName: card ? legendDisplayName(card) : row.cardName,
      cardSlug: card?.slug ?? row.cardId,
      shortCode: printing?.shortCode ?? "",
      setIndex: setIndexes.get(row.setId) ?? UNKNOWN_SET_INDEX,
      setName: set?.name ?? row.setId,
      domains: card?.domains ?? [],
      printing,
    };
  });
}

// Counts stay separate and price stays per-copy: a wished quantity can exceed
// what's available, so it must never read as count times price.
function MatchRowMeta({ match }: { match: DirectedMatch }) {
  return (
    <CardMetaLine
      printing={match.printing}
      rarity={match.rarity}
      trailing={
        match.liveOnly === true ? (
          <span>· {m.trades_match_promised({ count: match.buyQuantity })}</span>
        ) : (
          <>
            <span>· {m.trades_match_wanted({ count: match.buyQuantity })}</span>
            {match.direction === "outgoing" ? (
              <>
                <span>·</span>
                <AvailableCopiesPopover
                  cardId={match.cardId}
                  availableCount={match.availableCount}
                />
              </>
            ) : (
              <span>· {m.trades_market_person_available({ count: match.availableCount })}</span>
            )}
            <TradePerCopyPrice printingId={match.printingId} />
          </>
        )
      }
    />
  );
}

function MatchCopyMetadataLine({ match }: { match: AggregatedMatch }) {
  const { labels } = useEnumOrders();
  const { conditions, notes } = summarizeMatchCopies(match.copies, (copy) =>
    matchCopyConditionLabel(copy, labels),
  );
  if (conditions === null && notes.length === 0) {
    return null;
  }
  const noteText = notes.map((note) => `“${note}”`).join(" · ");
  const text = [conditions, noteText].filter((part) => part !== null && part !== "").join(" · ");
  return (
    <span className="text-muted-foreground truncate text-xs" title={text}>
      {text}
    </span>
  );
}

function MatchCopyNotesLine({ copies }: { copies: readonly MatchCopyDetail[] }) {
  const { notes } = summarizeMatchCopies(copies, () => null);
  if (notes.length === 0) {
    return null;
  }
  const text = notes.map((note) => `“${note}”`).join(" · ");
  return (
    <span className="text-muted-foreground truncate text-xs" title={text}>
      {text}
    </span>
  );
}

function MatchCopyConditionPills({ copies }: { copies: readonly MatchCopyDetail[] }) {
  const { labels } = useEnumOrders();
  const groups = groupMatchCopyConditions(copies, (copy) => {
    const full = matchCopyConditionLabel(copy, labels);
    if (full === null) {
      return null;
    }
    return { full, short: copy.condition === null ? full : conditionShortCode(copy.condition) };
  });
  return groups.map((group) => (
    <CountPill key={group.full} title={group.full}>
      {group.short}
      {group.count > 1 ? ` ×${group.count}` : null}
    </CountPill>
  ));
}

function MatchSourceLine({
  direction,
  listNames,
  counterpartyListNames,
}: {
  direction: MatchDirection;
  listNames: string[];
  counterpartyListNames: string[];
}) {
  const text = [
    describeViewerSource(direction, listNames),
    describeCounterpartySource(direction, counterpartyListNames),
  ]
    .filter((part) => part !== null)
    .join(" · ");
  if (text === "") {
    return null;
  }
  return (
    <span className="text-muted-foreground truncate text-xs" title={text}>
      {text}
    </span>
  );
}

function PriceVsEstimateLine({
  match,
  pref,
}: {
  match: DirectedMatch;
  pref: DirectedMatch["sellPref"];
}) {
  const prices = usePrices();
  const note = fixedPriceVsEstimate(
    pref,
    prices.get(match.printingId, "cardtrader"),
    match.direction,
  );
  if (note === null) {
    return null;
  }
  const amount = formatterForMarketplace("cardtrader")(note.difference);
  return (
    <span
      className={cn(
        "text-xs font-medium",
        note.kind === "match"
          ? "text-muted-foreground"
          : note.favorable
            ? "text-success"
            : "text-warning",
      )}
    >
      {note.kind === "match"
        ? m.trades_price_vs_estimate_match()
        : note.kind === "above"
          ? m.trades_price_vs_estimate_above({ amount })
          : m.trades_price_vs_estimate_below({ amount })}
    </span>
  );
}

function MatchRow({
  match,
  marketplaceInfos,
  liveTrade,
}: {
  match: DirectedMatch;
  marketplaceInfos: Record<Marketplace, MarketplaceLink> | null;
  liveTrade?: CardTradeResponse;
}) {
  const incoming = match.direction === "incoming";
  // Mouse-only: iOS Safari synthesizes hover on tap, which would otherwise
  // open this 400px preview over most of the phone screen with no way to dismiss it.
  const rowRef = useRef<HTMLLIElement>(null);
  const { enterX, hoverProps } = useMouseHover();
  // sellPref is always the seller's side, buyPref the buyer's: the counterparty
  // is the seller when the card comes to the viewer, the buyer when it goes to them.
  const counterpartyPref = incoming ? match.sellPref : match.buyPref;
  const priceLabel = incoming ? m.trades_match_price() : m.trades_match_they_pay();
  const hasCounterpartyPref =
    counterpartyPref.pricePref !== null || counterpartyPref.tradeType !== null;

  return (
    <li
      ref={rowRef}
      {...hoverProps}
      className="group hover:bg-muted/50 flex flex-col gap-2 rounded-md px-2 py-1.5 transition-colors @lg:flex-row @lg:items-center @lg:gap-3"
    >
      <div className="flex min-w-0 items-center gap-3 @lg:contents">
        <TradeDirectionIcon incoming={incoming} />

        <CardArtThumb
          shape="strip"
          imageId={match.imageId}
          alt={match.cardName}
          landscape={
            match.printing ? getOrientation(match.printing.card.types) === "landscape" : false
          }
          rarity={match.rarity}
          domains={match.domains}
          className="h-10"
          loading="lazy"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <CardDetailNameButton
            printingId={match.printing ? sideKey(match.printing) : undefined}
            className="max-w-full self-start truncate font-medium"
          >
            {match.cardName}
          </CardDetailNameButton>
          <MatchRowMeta match={match} />
          <MatchCopyMetadataLine match={match} />
          <MatchSourceLine
            direction={match.direction}
            listNames={[match.viewerListName]}
            counterpartyListNames={[match.counterpartyListName]}
          />
          <PriceVsEstimateLine match={match} pref={counterpartyPref} />
          <MatchLiveTradesElsewhere
            cardId={match.cardId}
            direction={match.direction}
            shownTrades={[liveTrade]}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 @lg:contents">
        <div className="flex min-w-0 items-center gap-2 @lg:contents">
          {hasCounterpartyPref ? (
            <div className="shrink-0 text-right @lg:min-w-32 @lg:opacity-0 @lg:transition-opacity @lg:group-hover:opacity-100">
              <MatchPreferenceCell
                label={priceLabel}
                pref={counterpartyPref}
                marketplaceInfos={marketplaceInfos}
                searchQuery={match.cardName}
              />
            </div>
          ) : null}
        </div>

        <MatchRowTradeAction match={match} liveTrade={liveTrade} />
      </div>

      {enterX !== undefined && match.printing ? (
        <PrintingHoverPreview printing={match.printing} anchorRef={rowRef} cursorX={enterX} />
      ) : null}
    </li>
  );
}

export function mergeAcrossGroups(matches: readonly DirectedMatch[]): PersonMatch[] {
  const merged = new Map<string, PersonMatch>();
  for (const match of matches) {
    const key = `${match.direction}\0${match.counterpartyUserId}\0${match.buyEntryId}\0${match.cardId}\0${match.counterpartyListId}\0${match.printingId}`;
    const existing = merged.get(key);
    if (existing === undefined) {
      merged.set(key, { ...match, copies: [...match.copies], groupChoices: [match] });
      continue;
    }
    existing.groupChoices.push(match);
    const seen = new Set(existing.copies.map((copy) => copy.copyId));
    existing.copies.push(...match.copies.filter((copy) => !seen.has(copy.copyId)));
    existing.availableCount = existing.copies.length;
  }
  return [...merged.values()].map((match) => {
    const sorted = match.groupChoices.toSorted((a, b) => b.availableCount - a.availableCount);
    return { ...match, groupChoices: [sorted[0] ?? match.groupChoices[0], ...sorted.slice(1)] };
  });
}

function aggregateMatches(rows: ResolvedMatchRow[]): AggregatedMatch[] {
  const aggregated = new Map<string, AggregatedMatch>();
  for (const row of rows) {
    const key = `${row.groupSlug}\0${row.buyEntryId}\0${row.cardId}\0${row.counterpartyListId}\0${row.printingId}`;
    const copy: RequestableCopy = {
      copyId: row.copyId,
      condition: row.condition,
      grader: row.grader,
      grade: row.grade,
      notesPublic: row.notesPublic,
    };
    const existing = aggregated.get(key);
    if (row.liveOnly === true) {
      aggregated.set(key, { ...row, availableCount: 0, copies: [] });
    } else if (existing) {
      existing.availableCount += 1;
      existing.copies.push(copy);
    } else {
      aggregated.set(key, { ...row, availableCount: 1, copies: [copy] });
    }
  }
  return [...aggregated.values()];
}

export interface MatchTradeGroup extends CatalogPosition {
  foldId: string;
  direction: MatchDirection;
  cardId: string;
  cardName: string;
  cardSlug: string;
  imageId: string | null;
  domains: string[];
  buyEntryKind: "card" | "printing";
  buyQuantity: number;
  counterpartyUserId: string;
  counterpartyName: string | null;
  counterpartyImage: string | null;
  counterpartyGravatarHash: string;
  totalAvailable: number;
  variants: [DirectedMatch, ...DirectedMatch[]];
}

// groupSlug is deliberately excluded from the key: a card reachable through
// two shared groups is one opportunity, not a duplicate tile per group.
export function groupTradeMatches(rows: DirectedMatch[]): MatchTradeGroup[] {
  const groups = new Map<string, MatchTradeGroup>();
  for (const row of rows) {
    const key = matchSuggestionKey(row.direction, row);
    const existing = groups.get(key);
    if (existing) {
      existing.variants.push(row);
      existing.totalAvailable += row.availableCount;
    } else {
      groups.set(key, {
        foldId: key,
        direction: row.direction,
        cardId: row.cardId,
        cardName: row.cardName,
        cardSlug: row.cardSlug,
        imageId: row.imageId,
        domains: row.domains,
        buyEntryKind: row.buyEntryKind,
        buyQuantity: row.buyQuantity,
        counterpartyUserId: row.counterpartyUserId,
        counterpartyName: row.counterpartyName,
        counterpartyImage: row.counterpartyImage,
        counterpartyGravatarHash: row.counterpartyGravatarHash,
        // Provisional: rewritten from the earliest variant once they're sorted.
        setIndex: row.setIndex,
        shortCode: row.shortCode,
        totalAvailable: row.availableCount,
        variants: [row],
      });
    }
  }
  for (const group of groups.values()) {
    group.variants.sort(compareCatalogPosition);
    group.setIndex = group.variants[0].setIndex;
    group.shortCode = group.variants[0].shortCode;
  }
  return [...groups.values()];
}

export function compareMatchTradeGroups(a: MatchTradeGroup, b: MatchTradeGroup): number {
  return (
    DIRECTION_ORDER[a.direction] - DIRECTION_ORDER[b.direction] ||
    compareCatalogPosition(a, b) ||
    a.cardName.localeCompare(b.cardName)
  );
}

function MatchTradeRowGroup({
  group,
  infosByPrinting,
  liveTrades,
}: {
  group: MatchTradeGroup;
  infosByPrinting: Record<string, Record<Marketplace, MarketplaceLink>>;
  liveTrades: ReadonlyMap<string, CardTradeResponse>;
}) {
  const expanded = useMatchVariantsFoldStore((state) => state.expanded.has(group.foldId));
  const toggle = useMatchVariantsFoldStore((state) => state.toggle);
  const incoming = group.direction === "incoming";
  const lead = group.variants[0];

  // Cheapest per-copy price across variants, shown as "from X" when they vary.
  // Per-copy, never times the wish quantity: a wish can exceed any one variant's stock.
  const prices = usePrices();
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const variantPrices = group.variants
    .map((variant) => prices.get(variant.printingId, marketplace))
    .filter((price) => price !== undefined);
  const cheapestUnit = variantPrices.length > 0 ? Math.min(...variantPrices) : undefined;
  const pricesVary =
    variantPrices.length > 0 && Math.min(...variantPrices) !== Math.max(...variantPrices);

  const variantTrades = group.variants.map((variant) =>
    liveTradeFor(liveTrades, variant, variant.direction),
  );
  const variantStatuses = variantTrades.map((trade) => trade?.status);
  const headerStatus: CardTradeStatus | null = variantStatuses.includes("reserved")
    ? "reserved"
    : variantStatuses.includes("pending")
      ? "pending"
      : null;

  return (
    <CardList className="gap-2">
      <li className="hover:bg-muted/50 relative flex flex-col gap-2 rounded-md px-2 py-1.5 transition-colors @lg:flex-row @lg:items-center @lg:gap-3">
        <div className="flex min-w-0 items-center gap-3 @lg:contents">
          <TradeDirectionIcon incoming={incoming} />

          <CardArtThumb
            shape="strip"
            imageId={group.imageId}
            alt={group.cardName}
            landscape={
              lead.printing ? getOrientation(lead.printing.card.types) === "landscape" : false
            }
            rarity={lead.rarity}
            domains={group.domains}
            className="h-10"
            loading="lazy"
          />

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="max-w-full self-start truncate font-medium">{group.cardName}</span>
            <span className="text-muted-foreground text-xs">
              {m.trades_match_variants({ count: group.variants.length })} ·{" "}
              {m.trades_match_wanted({ count: group.buyQuantity })} ·{" "}
              {group.direction === "outgoing" ? (
                <span className="relative z-10">
                  <AvailableCopiesPopover
                    cardId={group.cardId}
                    availableCount={group.totalAvailable}
                  />
                </span>
              ) : (
                <>{m.trades_market_person_available({ count: group.totalAvailable })}</>
              )}
              {cheapestUnit !== undefined && (
                <>
                  {" · "}
                  {pricesVary ? `${m.trades_match_price_from()} ` : ""}
                  <span className={cn("font-medium", priceColorClass(cheapestUnit))}>
                    {m.trades_per_copy_amount({
                      amount: compactFormatterForMarketplace(marketplace)(cheapestUnit),
                    })}
                  </span>
                </>
              )}
            </span>
            <MatchSourceLine
              direction={group.direction}
              listNames={group.variants.map((variant) => variant.viewerListName)}
              counterpartyListNames={group.variants.map((variant) => variant.counterpartyListName)}
            />
            <MatchLiveTradesElsewhere
              cardId={group.cardId}
              direction={group.direction}
              shownTrades={variantTrades}
            />
          </span>

          <ExpandToggle
            expanded={expanded}
            onClick={() => toggle(group.foldId)}
            aria-label={
              expanded
                ? m.trades_match_collapse_variants({ card: group.cardName })
                : m.trades_match_expand_variants({ card: group.cardName })
            }
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors before:absolute before:inset-0 before:content-[''] @lg:order-last"
            chevronClassName="text-inherit"
          />
        </div>

        {headerStatus ? (
          <div className="flex flex-wrap items-center gap-2 @lg:contents">
            <TradeStatusBadge status={headerStatus} className="min-w-0 shrink" />
          </div>
        ) : null}
      </li>

      {expanded
        ? group.variants.map((variant) => (
            <MatchRow
              key={`${variant.counterpartyListId}\0${variant.printingId}`}
              match={variant}
              marketplaceInfos={infosByPrinting[variant.printingId] ?? null}
              liveTrade={liveTradeFor(liveTrades, variant, variant.direction)}
            />
          ))
        : null}
    </CardList>
  );
}

function MatchGroupItem({
  group,
  infosByPrinting,
  liveTrades,
}: {
  group: MatchTradeGroup;
  infosByPrinting: Record<string, Record<Marketplace, MarketplaceLink>>;
  liveTrades: ReadonlyMap<string, CardTradeResponse>;
}) {
  if (group.variants.length > 1) {
    return (
      <MatchTradeRowGroup group={group} infosByPrinting={infosByPrinting} liveTrades={liveTrades} />
    );
  }
  const variant = group.variants[0];
  return (
    <CardList>
      <MatchRow
        match={variant}
        marketplaceInfos={infosByPrinting[variant.printingId] ?? null}
        liveTrade={liveTradeFor(liveTrades, variant, variant.direction)}
      />
    </CardList>
  );
}

interface MatchTradeListProps {
  incoming: MatchTradeListRow[];
  outgoing: MatchTradeListRow[];
  groupSlug: string;
}

function isBulkRequestable(
  group: MatchTradeGroup,
  liveTrades: ReadonlyMap<string, CardTradeResponse>,
): boolean {
  const variant = group.variants[0];
  return (
    group.direction === "incoming" &&
    group.variants.length === 1 &&
    maxTradeQuantity(group.buyQuantity, group.totalAvailable) > 0 &&
    liveTradeFor(liveTrades, variant, variant.direction) === undefined
  );
}

/** One request per printing: a double-sided printing wished for under both cards asks for the larger count. */
export function bulkTradeRequests(
  groups: readonly MatchTradeGroup[],
  liveTrades: ReadonlyMap<string, CardTradeResponse>,
): { variant: DirectedMatch; quantity: number }[] {
  const byPrinting = new Map<string, { variant: DirectedMatch; quantity: number }>();
  for (const group of groups) {
    if (!isBulkRequestable(group, liveTrades)) {
      continue;
    }
    const variant = group.variants[0];
    const key = `${variant.groupSlug}\0${variant.counterpartyUserId}\0${variant.printingId}`;
    const quantity = maxTradeQuantity(group.buyQuantity, group.totalAvailable);
    const existing = byPrinting.get(key);
    if (!existing || quantity > existing.quantity) {
      byPrinting.set(key, { variant, quantity });
    }
  }
  return [...byPrinting.values()];
}

function BulkRequestRow({
  groups,
  liveTrades,
}: {
  groups: MatchTradeGroup[];
  liveTrades: ReadonlyMap<string, CardTradeResponse>;
}) {
  const createTrade = useCreateTrade();
  const { refetch: refetchUserTrades } = useUserTrades();
  const [pending, setPending] = useState(false);
  const requests = bulkTradeRequests(groups, liveTrades);
  if (requests.length < 2) {
    return null;
  }

  async function requestAll(): Promise<void> {
    setPending(true);
    await Promise.all(
      requests.map(({ variant, quantity }) =>
        runReportedMutation(() =>
          createTrade.mutateAsync({
            groupSlug: variant.groupSlug,
            counterpartyUserId: variant.counterpartyUserId,
            role: "receiver",
            printingId: variant.printingId,
            cardId: variant.cardId,
            quantity,
          }),
        ),
      ),
    );
    await refetchUserTrades();
    setPending(false);
  }

  return (
    <div className="flex items-center justify-end">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => void requestAll()}>
        {m.trades_match_request_all({ count: requests.length })}
      </Button>
    </div>
  );
}

function MatchPersonRow({
  match,
  marketplaceInfos,
  liveTrade,
  onHide,
  hidePending,
}: {
  match: PersonMatch;
  marketplaceInfos: Record<Marketplace, MarketplaceLink> | null;
  liveTrade?: CardTradeResponse;
  onHide?: () => void;
  hidePending?: boolean;
}) {
  const name = memberName(match.counterpartyName);
  const incoming = match.direction === "incoming";
  const pref = incoming ? match.sellPref : match.buyPref;
  return (
    <li className="flex items-start gap-3 border-b py-3 last:border-b-0">
      <UserAvatar
        image={match.counterpartyImage}
        name={match.counterpartyName}
        gravatarHash={match.counterpartyGravatarHash}
        size="sm"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{name}</span>
        <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
          {match.liveOnly === true
            ? m.trades_match_promised({ count: match.buyQuantity })
            : incoming
              ? m.trades_market_person_available({ count: match.availableCount })
              : m.trades_market_person_wants({ count: match.buyQuantity })}
          {incoming ? <MatchCopyConditionPills copies={match.copies} /> : null}
        </span>
        {incoming ? <MatchCopyNotesLine copies={match.copies} /> : null}
        <MatchPreferenceText
          pref={pref}
          printingId={match.printingId}
          marketplaceInfos={marketplaceInfos}
          searchQuery={match.cardName}
        />
        <PriceVsEstimateLine match={match} pref={pref} />
        <MatchLiveTradesElsewhere
          cardId={match.cardId}
          direction={match.direction}
          shownTrades={[liveTrade]}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onHide === undefined ? null : (
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
            aria-label={m.trades_market_hide_one({ name })}
            title={m.trades_market_hide_one({ name })}
            disabled={hidePending}
            onClick={onHide}
          >
            <EyeOffIcon />
          </Button>
        )}
        <MatchRowTradeAction match={match} liveTrade={liveTrade} />
      </div>
    </li>
  );
}

export function MatchPersonList({
  rows,
  direction,
  groupSlug,
  onHide,
  hidePending,
}: {
  rows: MatchTradeListRow[];
  direction: MatchDirection;
  groupSlug: string;
  onHide?: (counterpartyUserId: string) => void;
  hidePending?: boolean;
}) {
  const { cardsById, printingsById, printingsByCardId, sets } = useCards();
  const { data: userTrades } = useUserTrades();
  const liveTrades = liveTradeIndex(userTrades?.items ?? []);
  const printingIds = [...new Set(rows.map((row) => row.printingId))];
  const { data: marketplaceInfo } = useMarketplaceLinks(printingIds);
  const matches = mergeAcrossGroups(
    aggregateMatches(
      resolveMatchRows(rows, cardsById, printingsById, sets, groupSlug, printingsByCardId),
    ).map((match): DirectedMatch => ({ ...match, direction })),
  );

  return (
    <ul className="flex flex-col">
      {matches.map((match) => (
        <MatchPersonRow
          key={`${match.counterpartyUserId}:${match.buyEntryId}:${match.counterpartyListId}:${match.printingId}`}
          match={match}
          marketplaceInfos={marketplaceInfo?.links[match.printingId] ?? null}
          liveTrade={liveTradeFor(liveTrades, match, match.direction)}
          onHide={onHide === undefined ? undefined : () => onHide(match.counterpartyUserId)}
          hidePending={hidePending}
        />
      ))}
    </ul>
  );
}

export function MatchTradeList({ incoming, outgoing, groupSlug }: MatchTradeListProps) {
  const { cardsById, printingsById, printingsByCardId, sets } = useCards();
  const { data: userTrades } = useUserTrades();
  const liveTrades = liveTradeIndex(userTrades?.items ?? []);

  const printingIds = [...new Set([...incoming, ...outgoing].map((row) => row.printingId))];
  const { data: marketplaceInfo } = useMarketplaceLinks(printingIds);

  const incomingRows = aggregateMatches(
    resolveMatchRows(incoming, cardsById, printingsById, sets, groupSlug, printingsByCardId),
  ).map((match): DirectedMatch => ({ ...match, direction: "incoming" }));
  const outgoingRows = aggregateMatches(
    resolveMatchRows(outgoing, cardsById, printingsById, sets, groupSlug, printingsByCardId),
  ).map((match): DirectedMatch => ({ ...match, direction: "outgoing" }));
  const groups = groupTradeMatches([...incomingRows, ...outgoingRows]).toSorted(
    compareMatchTradeGroups,
  );
  const infosByPrinting = marketplaceInfo?.links ?? {};

  return (
    <div className="@container flex flex-col gap-2">
      <BulkRequestRow groups={groups} liveTrades={liveTrades} />
      {groups.map((group) => (
        <MatchGroupItem
          key={group.foldId}
          group={group}
          infosByPrinting={infosByPrinting}
          liveTrades={liveTrades}
        />
      ))}
    </div>
  );
}
