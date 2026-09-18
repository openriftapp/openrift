import { ZONE_LABELS } from "@openrift/shared/deck-zones";
import { imageUrl } from "@openrift/shared/image-url";
import type { DeckListItemResponse } from "@openrift/shared/types/api/deck";
import type { Card, Printing } from "@openrift/shared/types/catalog";
import { getOrientation } from "@openrift/shared/utils";
import { WellKnown } from "@openrift/shared/well-known";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardPasteIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarBack,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { CommandEmpty, CommandGroup } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { PickerList, PickerRow } from "@/components/ui/picker-list";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { CardMiniRow } from "@/features/cards/components/card-mini-row";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { EnergyGlyph, PowerPips } from "@/features/decks/components/deck-card-row";
import type { PastedCompareSource } from "@/features/decks/components/deck-compare-paste-dialog";
import { DeckComparePasteDialog } from "@/features/decks/components/deck-compare-paste-dialog";
import type { DeckIdentity } from "@/features/decks/components/deck-mini-identity";
import { DeckMiniIdentity } from "@/features/decks/components/deck-mini-identity";
import { DeckZoneHeader } from "@/features/decks/components/deck-zone-header";
import { HoveredCardPreview } from "@/features/decks/components/hovered-card-preview";
import type { CompareSide } from "@/features/decks/lib/deck-compare-side";
import { parseCompareSide } from "@/features/decks/lib/deck-compare-side";
import type { OwnDeckCard } from "@/features/decks/lib/deck-compare-sources";
import {
  collectCompareDeckOptions,
  ownDeckDiffCards,
} from "@/features/decks/lib/deck-compare-sources";
import type { DeckDiffCard } from "@/features/decks/lib/deck-diff";
import type { SideBySideRow } from "@/features/decks/lib/deck-side-by-side";
import { alignDeckLists } from "@/features/decks/lib/deck-side-by-side";
import {
  deckDetailQueryOptions,
  decksQueryOptions,
  publicDeckQueryOptions,
} from "@/features/decks/lib/decks-queries";
import type { LocalDeck } from "@/features/decks/lib/local-deck";
import { isLocalDeckId } from "@/features/decks/lib/local-deck";
import { useLocalDecksStore } from "@/features/decks/stores/local-decks-store";
import { metaDeckQueryOptions } from "@/features/meta/lib/meta-queries";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useEnumOrders } from "@/hooks/use-enums";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useUserId } from "@/lib/auth-session";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** Which column a picker fills. Doubles as the search-param name. */
type SideKey = "from" | "to";

const CELL_STYLES: Record<SideBySideRow["kind"], { from: string; to: string }> = {
  same: { from: "text-muted-foreground", to: "text-muted-foreground" },
  add: {
    from: "text-muted-foreground/60",
    to: "bg-success-soft text-success",
  },
  cut: { from: "bg-destructive-soft text-destructive", to: "text-muted-foreground/60" },
  change: {
    from: "bg-warning-soft text-warning",
    to: "bg-warning-soft text-warning",
  },
};

/** Both sides share the printing: the catalog's default, not either deck's pinned art. */
interface RowCatalog {
  card?: Card;
  printing?: Printing;
}

/** Everything the rows read from a hook, lifted to the page — see `CardMiniRow`. */
interface RowDisplay {
  domainColors: Record<string, string>;
  rarityLabels: Record<string, string>;
  domainLabels: Record<string, string>;
}

function SideCell({
  count,
  row,
  catalog,
  display,
  className,
}: {
  count: number;
  row: SideBySideRow;
  catalog: RowCatalog;
  display: RowDisplay;
  className: string;
}) {
  if (count === 0) {
    return <span className={cn("flex min-h-8 items-center px-2", className)}>—</span>;
  }
  const { card, printing } = catalog;
  return (
    <span
      className={cn("flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 sm:gap-2", className)}
    >
      <CardMiniRow
        className="self-stretch"
        imageId={printing?.images.find((image) => image.face === "front")?.imageId}
        landscape={card ? getOrientation(card.types) === "landscape" : false}
        domains={card?.domains}
        domainColors={display.domainColors}
        rarity={printing?.rarity}
        rarityLabels={display.rarityLabels}
        shortCode={printing?.shortCode}
        loading="lazy"
        hideMetaOnMobile
      />

      <span className="w-6 shrink-0 text-right tabular-nums">{count}×</span>

      <span className="min-w-0 flex-1 truncate">{row.cardName}</span>

      <PowerPips
        power={card?.power ?? null}
        domains={card?.domains ?? []}
        colors={display.domainColors}
        domainLabels={display.domainLabels}
      />

      {card?.energy !== null && card !== undefined && <EnergyGlyph value={card.energy} />}
    </span>
  );
}

function ChangesRow({
  row,
  catalog,
  display,
  onHover,
}: {
  row: SideBySideRow;
  catalog: RowCatalog;
  display: RowDisplay;
  onHover: (cardId: string | null) => void;
}) {
  const styles = CELL_STYLES[row.kind];
  return (
    <div
      className="hover:bg-muted/50 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md text-sm"
      onMouseEnter={() => onHover(row.cardId)}
      onMouseLeave={() => onHover(null)}
    >
      <SideCell
        count={row.from}
        row={row}
        catalog={catalog}
        display={display}
        className={styles.from}
      />
      <ArrowRightIcon
        aria-hidden
        className={cn(
          "size-3 shrink-0",
          row.kind === "same" ? "text-muted-foreground/30" : "text-muted-foreground",
        )}
      />
      <SideCell
        count={row.to}
        row={row}
        catalog={catalog}
        display={display}
        className={styles.to}
      />
    </div>
  );
}

function DeckPicker({
  label,
  side,
  identity,
  pastedText,
  familyIds,
  otherIds,
  identityById,
  onPick,
  onPaste,
  onClear,
}: {
  label: string;
  side: CompareSide | null;
  identity: DeckIdentity | null;
  pastedText: string | null;
  familyIds: string[];
  otherIds: string[];
  identityById: ReadonlyMap<string, DeckIdentity>;
  onPick: (deckId: string) => void;
  onPaste: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Reset per open, not once: picking changes `value` while this stays mounted.
  const [highlightedId, setHighlightedId] = useState("");
  const name = identity?.name ?? m.decks_compare_choose_deck();
  const value = side?.kind === "deck" ? side.deckId : null;

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setHighlightedId(value ?? "");
    }
    setOpen(next);
  };

  const pick = (deckId: string) => {
    setOpen(false);
    onPick(deckId);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {/* A caption, not a form label: the control below is a menu button, which
          `<label for>` can't point at. */}
      <span className="text-sm leading-none font-medium">{label}</span>
      <div className="flex min-w-0 items-stretch gap-2">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger
            render={
              <Pressable
                aria-label={`${label}: ${name}`}
                className="bg-card ring-border hover:bg-muted/50 flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-lg pr-2 ring-1 transition-colors"
              />
            }
          >
            {identity ? (
              <DeckMiniIdentity identity={identity} className="min-w-0 flex-1" />
            ) : (
              <span className="text-muted-foreground min-w-0 flex-1 truncate p-2 text-sm">
                {name}
              </span>
            )}
            <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-80 max-w-(--available-width) gap-0 p-0 sm:w-96"
          >
            <PickerList
              searchPlaceholder={m.decks_compare_search_decks()}
              highlightedId={highlightedId}
              onHighlightChange={setHighlightedId}
            >
              <CommandEmpty>{m.decks_compare_no_decks_match()}</CommandEmpty>
              {familyIds.length > 0 && (
                <CommandGroup
                  className="p-0"
                  heading={familyIds.length > 1 ? m.decks_compare_versions_heading() : undefined}
                >
                  {familyIds.map((deckId) => (
                    <DeckPickerRow
                      key={deckId}
                      deckId={deckId}
                      identityById={identityById}
                      selected={deckId === value}
                      onSelect={pick}
                    />
                  ))}
                </CommandGroup>
              )}
              {otherIds.length > 0 && (
                <CommandGroup
                  className="p-0 pt-2"
                  heading={
                    familyIds.length > 0
                      ? m.decks_compare_other_decks_heading()
                      : m.decks_compare_your_decks_heading()
                  }
                >
                  {otherIds.map((deckId) => (
                    <DeckPickerRow
                      key={deckId}
                      deckId={deckId}
                      identityById={identityById}
                      selected={deckId === value}
                      onSelect={pick}
                    />
                  ))}
                </CommandGroup>
              )}
            </PickerList>
            <div className="p-1 pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => {
                  setOpen(false);
                  onPaste();
                }}
              >
                <ClipboardPasteIcon className="size-4" />
                {m.decks_compare_paste_action()}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {side !== null && (
          <Button variant="outline" className="self-center" render={openSideLink(side, name)}>
            {m.decks_compare_open()}
          </Button>
        )}
        {pastedText !== null && (
          <Button
            variant="outline"
            className="self-center"
            render={
              <Link
                to="/decks/import"
                search={{ code: pastedText }}
                aria-label={m.decks_compare_save_pasted_aria()}
              />
            }
          >
            {m.common_save()}
          </Button>
        )}
        {(side !== null || pastedText !== null) && (
          <Button
            variant="ghost"
            size="icon"
            className="self-center"
            aria-label={m.decks_compare_clear_aria({ side: label.toLowerCase() })}
            onClick={onClear}
          >
            <XIcon className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** One deck's row in a picker list; null if the deck went away. */
function DeckPickerRow({
  deckId,
  identityById,
  selected,
  onSelect,
}: {
  deckId: string;
  identityById: ReadonlyMap<string, DeckIdentity>;
  selected: boolean;
  onSelect: (deckId: string) => void;
}) {
  const identity = identityById.get(deckId);
  if (!identity) {
    return null;
  }
  return (
    <PickerRow
      value={deckId}
      keywords={[identity.name]}
      onSelect={() => onSelect(deckId)}
      className="gap-0 p-0 pr-2"
    >
      <DeckMiniIdentity identity={identity} className="min-w-0 flex-1 rounded-md" />
      <CheckIcon className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
    </PickerRow>
  );
}

function countCopies(cards: readonly OwnDeckCard[]): number {
  return cards.reduce((total, card) => total + card.quantity, 0);
}

function serverIdentity(item: DeckListItemResponse): DeckIdentity {
  return {
    name: item.deck.name,
    legendCardId: item.legendCardId,
    championCardId: item.championCardId,
    cardCount: item.totalCards,
    updatedAt: item.deck.updatedAt,
  };
}

/** The list endpoint's legend and champion ids have no local equivalent, so these come off the deck's own rows. */
function localIdentity(deck: LocalDeck): DeckIdentity {
  return {
    name: deck.name,
    legendCardId: deck.cards.find((card) => card.zone === WellKnown.deckZone.LEGEND)?.cardId,
    championCardId: deck.cards.find((card) => card.zone === WellKnown.deckZone.CHAMPION)?.cardId,
    cardCount: countCopies(deck.cards),
    updatedAt: deck.updatedAt,
  };
}

function cardsIdentity(name: string, cards: readonly OwnDeckCard[]): DeckIdentity {
  return {
    name,
    legendCardId: cards.find((card) => card.zone === WellKnown.deckZone.LEGEND)?.cardId,
    championCardId: cards.find((card) => card.zone === WellKnown.deckZone.CHAMPION)?.cardId,
    cardCount: countCopies(cards),
  };
}

interface SideData {
  rows: readonly OwnDeckCard[] | null;
  /** Set for a meta or shared deck, which the picker's own-deck identities don't cover. */
  linkIdentity: DeckIdentity | null;
}

const NO_SIDE: SideData = { rows: null, linkIdentity: null };

/** A `local:` id resolves from the browser store; server ids and deck links go through their queries, already warmed by the route for the sides it opened with. */
function useSideData(side: CompareSide | null, userId: string | null): SideData {
  const localDecks = useLocalDecksStore((state) => state.decks);
  const deckId = side?.kind === "deck" ? side.deckId : null;
  const isLocal = deckId !== null && isLocalDeckId(deckId);
  const { data } = useQuery({
    ...deckDetailQueryOptions(userId ?? "", deckId ?? ""),
    enabled: deckId !== null && !isLocal && userId !== null,
  });
  const { data: metaData } = useQuery({
    ...metaDeckQueryOptions(side?.kind === "meta" ? side.token : ""),
    enabled: side?.kind === "meta",
  });
  const { data: shareData } = useQuery({
    ...publicDeckQueryOptions(side?.kind === "share" ? side.token : ""),
    enabled: side?.kind === "share",
  });
  if (side === null) {
    return NO_SIDE;
  }
  if (side.kind !== "deck") {
    const linked = side.kind === "meta" ? metaData : shareData;
    return linked
      ? { rows: linked.cards, linkIdentity: cardsIdentity(linked.deck.name, linked.cards) }
      : NO_SIDE;
  }
  if (isLocal) {
    return { rows: localDecks[side.deckId]?.cards ?? null, linkIdentity: null };
  }
  return { rows: data?.cards ?? null, linkIdentity: null };
}

/** Built as an element for a `render` prop, which merges its own props into it. */
function openSideLink(side: CompareSide, name: string) {
  const ariaLabel = m.decks_compare_open_aria({ name });
  if (side.kind === "meta") {
    return <Link to="/meta/decks/$token" params={{ token: side.token }} aria-label={ariaLabel} />;
  }
  if (side.kind === "share") {
    return <Link to="/decks/share/$token" params={{ token: side.token }} aria-label={ariaLabel} />;
  }
  return <Link to="/decks/$deckId" params={{ deckId: side.deckId }} aria-label={ariaLabel} />;
}

export function DeckComparePage({ fromId, toId }: { fromId?: string; toId?: string }) {
  const [changesOnly, setChangesOnly] = useState(true);
  const [pastedFrom, setPastedFrom] = useState<PastedCompareSource | null>(null);
  const [pastedTo, setPastedTo] = useState<PastedCompareSource | null>(null);
  const [pasteFor, setPasteFor] = useState<SideKey | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const userId = useUserId();
  const { cardsById } = useCards();
  const { getPreferredPrinting } = usePreferredPrinting();
  const { labels } = useEnumOrders();
  const domainColors = useDomainColors();
  const localDecks = useLocalDecksStore((state) => state.decks);
  const { data: serverDecks } = useQuery({
    ...decksQueryOptions(userId ?? ""),
    enabled: userId !== null,
  });

  const display: RowDisplay = {
    domainColors,
    rarityLabels: labels.rarities,
    domainLabels: labels.domains,
  };

  const items = serverDecks ?? [];
  const identityById = new Map<string, DeckIdentity>();
  for (const item of items) {
    identityById.set(item.deck.id, serverIdentity(item));
  }
  for (const deck of Object.values(localDecks)) {
    identityById.set(deck.id, localIdentity(deck));
  }

  const anchor = parseCompareSide(toId ?? fromId);
  const anchorId = anchor?.kind === "deck" ? anchor.deckId : null;
  const anchorFamilyId = items.find((item) => item.deck.id === anchorId)?.deck.familyId ?? null;
  const familyIds =
    anchorFamilyId === null
      ? anchorId !== null && identityById.has(anchorId)
        ? [anchorId]
        : []
      : items
          .filter((item) => item.deck.familyId === anchorFamilyId)
          .toSorted((left, right) => right.deck.updatedAt.localeCompare(left.deck.updatedAt))
          .map((item) => item.deck.id);
  const familySet = new Set(familyIds);
  const otherIds = collectCompareDeckOptions(anchorId ?? "", items, localDecks)
    .filter((option) => !familySet.has(option.id))
    .map((option) => option.id);

  const fromParam = pastedFrom ? null : (fromId ?? null);
  const toParam = pastedTo ? null : (toId ?? null);
  const fromSide = parseCompareSide(fromParam ?? undefined);
  const toSide = parseCompareSide(toParam ?? undefined);
  const fromData = useSideData(fromSide, userId);
  const toData = useSideData(toSide, userId);

  const fromCards: DeckDiffCard[] | null = pastedFrom
    ? pastedFrom.cards
    : fromData.rows
      ? ownDeckDiffCards(fromData.rows, cardsById).theirs
      : null;
  const toCards: DeckDiffCard[] | null = pastedTo
    ? pastedTo.cards
    : toData.rows
      ? ownDeckDiffCards(toData.rows, cardsById).theirs
      : null;

  const sideIdentity = (
    pasted: PastedCompareSource | null,
    side: CompareSide | null,
    data: SideData,
  ): DeckIdentity | null => {
    if (pasted) {
      return cardsIdentity(m.decks_compare_pasted_list(), pasted.cards);
    }
    if (side?.kind === "deck") {
      return identityById.get(side.deckId) ?? null;
    }
    return data.linkIdentity;
  };
  const fromIdentity = sideIdentity(pastedFrom, fromSide, fromData);
  const toIdentity = sideIdentity(pastedTo, toSide, toData);

  const zones = fromCards && toCards ? alignDeckLists(fromCards, toCards) : [];
  const rows = zones.flatMap((zone) => zone.rows);
  const sharedCount = rows.reduce((total, row) => total + Math.min(row.from, row.to), 0);
  const bothChosen =
    (fromParam !== null || pastedFrom !== null) && (toParam !== null || pastedTo !== null);
  const bothPicked = fromCards !== null && toCards !== null;
  const isIdentical = bothPicked && rows.every((row) => row.kind === "same");
  const unmatched = [...(pastedFrom?.unmatched ?? []), ...(pastedTo?.unmatched ?? [])];

  /** A deck id from the picker, or a `meta:`/`share:` param from a pasted link. */
  const handlePick = (side: SideKey, pickedParam: string) => {
    if (side === "from") {
      setPastedFrom(null);
    } else {
      setPastedTo(null);
    }
    void navigate({
      to: "/decks/compare",
      search: {
        from: side === "from" ? pickedParam : (fromParam ?? undefined),
        to: side === "to" ? pickedParam : (toParam ?? undefined),
      },
    });
  };

  const handleClear = (side: SideKey) => {
    if (side === "from") {
      setPastedFrom(null);
    } else {
      setPastedTo(null);
    }
    void navigate({
      to: "/decks/compare",
      search: {
        from: side === "from" ? undefined : (fromParam ?? undefined),
        to: side === "to" ? undefined : (toParam ?? undefined),
      },
      replace: true,
    });
  };

  const handlePasted = (source: PastedCompareSource) => {
    if (pasteFor === "from") {
      setPastedFrom(source);
    } else {
      setPastedTo(source);
    }
    // The pasted side leaves the URL: it can't be linked to, and a stale id
    // there would come back the moment the other side changes.
    void navigate({
      to: "/decks/compare",
      search: {
        from: pasteFor === "from" ? undefined : (fromParam ?? undefined),
        to: pasteFor === "to" ? undefined : (toParam ?? undefined),
      },
      replace: true,
    });
  };

  const hoveredPrinting =
    hoveredCardId !== null && !isMobile ? (getPreferredPrinting(hoveredCardId) ?? null) : null;
  const hoveredImage = hoveredPrinting?.images.find((image) => image.face === "front") ?? null;
  const hoveredCard =
    hoveredPrinting && hoveredImage
      ? {
          thumbnailUrl: imageUrl(hoveredImage.imageId, "400w"),
          fullUrl: imageUrl(hoveredImage.imageId, "full"),
          landscape: getOrientation(hoveredPrinting.card.types) === "landscape",
        }
      : null;

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          {anchor?.kind === "deck" && (
            <PageTopBarBack
              to="/decks/$deckId"
              params={{ deckId: anchor.deckId }}
              aria-label={m.decks_compare_back_to_deck()}
            />
          )}
          {anchor?.kind === "meta" && (
            <PageTopBarBack
              to="/meta/decks/$token"
              params={{ token: anchor.token }}
              aria-label={m.decks_compare_back_to_deck()}
            />
          )}
          {anchor?.kind === "share" && (
            <PageTopBarBack
              to="/decks/share/$token"
              params={{ token: anchor.token }}
              aria-label={m.decks_compare_back_to_deck()}
            />
          )}
          {anchor === null && (
            <PageTopBarBack to="/decks" aria-label={m.decks_compare_back_to_decks()} />
          )}
          <PageTopBarTitle>{m.decks_compare_title()}</PageTopBarTitle>
          <PageTopBarActions>
            <Switch id="deck-changes-only" checked={changesOnly} onCheckedChange={setChangesOnly} />
            <Label htmlFor="deck-changes-only" className="font-normal">
              {m.decks_compare_only_changed()}
            </Label>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>

      <div ref={containerRef} className="relative">
        <div className={cn(PAGE_WIDTH.capped, PAGE_PADDING_NO_TOP, "flex flex-col gap-6 pt-3")}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-2">
            <DeckPicker
              label={m.decks_compare_from()}
              side={fromSide}
              identity={fromIdentity}
              pastedText={pastedFrom?.text ?? null}
              familyIds={familyIds}
              otherIds={otherIds}
              identityById={identityById}
              onPick={(picked) => handlePick("from", picked)}
              onPaste={() => setPasteFor("from")}
              onClear={() => handleClear("from")}
            />
            <span className="hidden items-center justify-center self-stretch pt-6 sm:flex">
              <ArrowRightIcon aria-hidden className="text-muted-foreground size-3 shrink-0" />
            </span>
            <DeckPicker
              label={m.decks_compare_to()}
              side={toSide}
              identity={toIdentity}
              pastedText={pastedTo?.text ?? null}
              familyIds={familyIds}
              otherIds={otherIds}
              identityById={identityById}
              onPick={(picked) => handlePick("to", picked)}
              onPaste={() => setPasteFor("to")}
              onClear={() => handleClear("to")}
            />
          </div>

          {bothPicked && (
            <p className="text-muted-foreground text-sm tabular-nums">
              {m.decks_compare_shared({ count: sharedCount })}
            </p>
          )}

          {!bothChosen && <p className="text-muted-foreground">{m.decks_compare_intro()}</p>}
          {isIdentical && <p className="text-sm">{m.decks_compare_identical()}</p>}

          {unmatched.length > 0 && (
            <div className="text-muted-foreground flex flex-col gap-1">
              <p className="text-sm">{m.decks_compare_unmatched({ count: unmatched.length })}</p>
              <ul className="text-2xs flex flex-col gap-0.5">
                {unmatched.map((line, index) => (
                  // Duplicate raw lines are possible, so the index is part of the key.
                  <li key={`${line}-${index}`} className="truncate">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-6">
            {zones.map((zone) => {
              const zoneRows = changesOnly
                ? zone.rows.filter((row) => row.kind !== "same")
                : zone.rows;
              if (zoneRows.length === 0) {
                return null;
              }
              return (
                <section key={zone.zone} className="flex min-w-0 flex-col gap-1">
                  <DeckZoneHeader label={ZONE_LABELS[zone.zone]} />
                  {zoneRows.map((row) => (
                    <ChangesRow
                      key={`${zone.zone}-${row.cardId}`}
                      row={row}
                      catalog={{
                        card: cardsById[row.cardId],
                        printing: getPreferredPrinting(row.cardId),
                      }}
                      display={display}
                      onHover={setHoveredCardId}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        </div>

        <HoveredCardPreview hoveredCard={hoveredCard} origin="main" containerRef={containerRef} />
      </div>

      <DeckComparePasteDialog
        open={pasteFor !== null}
        onOpenChange={(open) => setPasteFor(open ? pasteFor : null)}
        onResolved={handlePasted}
        onLinked={(sideParam) => handlePick(pasteFor ?? "to", sideParam)}
      />
    </>
  );
}
