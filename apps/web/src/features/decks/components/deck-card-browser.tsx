import { copyLimitFor, formatHasSideboard, totalQuantity } from "@openrift/shared/deck-rules";
import { isSingleSlotZone, ZONE_LABELS } from "@openrift/shared/deck-zones";
import { imageUrl } from "@openrift/shared/image-url";
import { sideKey } from "@openrift/shared/printing-side";
import type { DeckResponse } from "@openrift/shared/types/api/deck";
import type { Printing } from "@openrift/shared/types/catalog";
import type { DeckZone } from "@openrift/shared/types/enums";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { WellKnown } from "@openrift/shared/well-known";
import { PackageCheckIcon, PlusIcon } from "lucide-react";
import { Suspense, useDeferredValue, useLayoutEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrowserCardViewer } from "@/features/cards/components/browser-card-viewer";
import {
  BrowserToolbar,
  CardBrowserFilterProvider,
} from "@/features/cards/components/card-browser-filter-scaffold";
import { CardCell } from "@/features/cards/components/card-cell";
import { SelectionDetailOverlays } from "@/features/cards/components/selection-detail-overlays";
import { SelectionDetailPane } from "@/features/cards/components/selection-detail-pane";
import { useCardData } from "@/features/cards/hooks/use-card-data";
import { useFilterActions, useFilterValues } from "@/features/cards/hooks/use-card-filters";
import { useCardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useGridKeyboardNav } from "@/features/cards/hooks/use-grid-keyboard-nav";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { ADD_STRIP_HEIGHT } from "@/features/cards/lib/card-grid-constants";
import type { CardOpenTarget, HoverHandler } from "@/features/cards/lib/card-row-interactions";
import { splitsCardIntoTiles } from "@/features/cards/lib/card-tiles";
import { useCustomTagAssignments } from "@/features/collections/hooks/use-custom-tag-assignments";
import { useDeckBuildingCounts } from "@/features/collections/hooks/use-owned-count";
import { useRowActionHandlers } from "@/features/collections/hooks/use-row-action-handlers";
import { maxOwnedCount } from "@/features/collections/lib/owned-bucket";
import { CardQuantityChip } from "@/features/decks/components/card-quantity-chip";
import { DeckAddStrip } from "@/features/decks/components/deck-add-strip";
import { DeckCardDetailMenu } from "@/features/decks/components/deck-card-detail-menu";
import { DeckCardZoneSteppers } from "@/features/decks/components/deck-card-zone-steppers";
import { DeckCountMark } from "@/features/decks/components/deck-count-mark";
import { DeckOverview } from "@/features/decks/components/deck-overview";
import { DeckPlanEditor } from "@/features/decks/components/deck-plan-editor";
import { DeckTableActions } from "@/features/decks/components/deck-table-actions";
import {
  FormatTagPickBanner,
  needsFormatTagPick,
} from "@/features/decks/components/format-tag-pick-banner";
import {
  focusCatalogCard,
  WorkbenchCardDetail,
} from "@/features/decks/components/workbench-card-detail";
import { WorkbenchZoneBar } from "@/features/decks/components/workbench-zone-bar";
import { useDeckBuilderActions, useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useDeckItems } from "@/features/decks/hooks/use-deck-items";
import { useDeckDetail, useUpdateDeck } from "@/features/decks/hooks/use-decks";
import { useIsLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import {
  buildDeckQuantityByCell,
  deckCellKey,
  canAddRune,
  catalogCardToDeckBuilderCard,
  cellPreferredPrintingId,
  isDeckZoneFullForDrag,
  RUNE_TARGET,
} from "@/features/decks/lib/deck-builder-card";
import type { DeckOwnershipData } from "@/features/decks/lib/deck-ownership-types";
import { buildRunesByDomain } from "@/features/decks/lib/deck-runes-by-domain";
import { deckZoneFilterPreset } from "@/features/decks/lib/deck-zone-filters";
import { getFormatTagConfig } from "@/features/decks/lib/format-tag-config";
import { flyCardToDeck } from "@/features/decks/lib/workbench-fly-to-dock";
import { applyZoneLayer } from "@/features/decks/lib/workbench-zone-layer";
import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { useChannelRegistry } from "@/hooks/use-enums";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useKeywordReverseMap } from "@/hooks/use-keyword-reverse-map";
import { useSeedLanguagesFromPrefs } from "@/hooks/use-seed-languages-from-prefs";
import { useSession } from "@/hooks/use-session";
import { useShiftHeld } from "@/hooks/use-shift-held";
import { useStableByValue } from "@/hooks/use-stable-by-value";
import type { CardRenderContext, CardViewerItem } from "@/lib/card-viewer-types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";
import { useSelectionStore } from "@/stores/selection-store";

function workbenchLimitText(zone: DeckZone, battlefieldsFull: boolean): string {
  if (zone === WellKnown.deckZone.BATTLEFIELD) {
    return battlefieldsFull
      ? m.decks_workbench_limit_battlefields()
      : m.decks_workbench_limit_battlefield_duplicate();
  }
  if (zone === WellKnown.deckZone.RUNES) {
    return m.decks_workbench_limit_runes();
  }
  if (zone === WellKnown.deckZone.LEGEND_OPTIONS) {
    return m.decks_workbench_limit_legend_options();
  }
  return m.decks_workbench_limit_copies();
}

function copyRemainderFor(
  card: { maxCopiesOverride: number | null },
  total: number,
): number | undefined {
  const limit = copyLimitFor(card);
  return Number.isFinite(limit) ? limit - total : undefined;
}

interface DeckActionsCellProps {
  printing?: Printing;
  view: "cards" | "printings";
  deckQuantityByCard: Map<string, number>;
  deckQuantityByCell: Map<string, number>;
  isSingleCardZone: boolean;
  singleCardZoneOccupied: boolean;
  deckCards: { cardId: string; zone: DeckZone }[];
  activeZone: DeckZone;
  isMaxReached: (item: CardViewerItem) => boolean;
  shiftHeld: boolean;
  runeTotal: number;
  copyLimitTotalByCard: Map<string, number>;
  handleQuickAdd: (printing: Printing, event: { shiftKey?: boolean }) => void;
  handleRemove: (printing: Printing, event: { shiftKey?: boolean }) => void;
}

function singleZoneAddAction(switching: boolean): {
  addLabel: string;
  addAriaLabel: string;
  addTooltip: string;
} {
  return switching
    ? {
        addLabel: m.decks_editor_switch(),
        addAriaLabel: m.decks_editor_switch_card_aria(),
        addTooltip: m.decks_editor_click_to_switch(),
      }
    : {
        addLabel: m.decks_editor_choose(),
        addAriaLabel: m.decks_editor_choose_card_aria(),
        addTooltip: m.decks_editor_click_to_choose(),
      };
}

function DeckActionsCell({
  printing,
  view,
  deckQuantityByCard,
  deckQuantityByCell,
  isSingleCardZone,
  singleCardZoneOccupied,
  deckCards,
  activeZone,
  isMaxReached,
  shiftHeld,
  runeTotal,
  copyLimitTotalByCard,
  handleQuickAdd,
  handleRemove,
}: DeckActionsCellProps) {
  if (!printing) {
    return null;
  }
  const cardId = printing.cardId;
  const deckQty =
    view === "printings"
      ? (deckQuantityByCell.get(deckCellKey(cardId, printing.printingId)) ?? 0)
      : (deckQuantityByCard.get(cardId) ?? 0);
  const isInActiveSingleZone =
    isSingleCardZone &&
    deckCards.some((card) => card.cardId === cardId && card.zone === activeZone);
  return (
    <DeckTableActions
      printing={printing}
      deckQuantity={deckQty}
      maxReached={isMaxReached({ id: sideKey(printing), printing })}
      {...(isSingleCardZone
        ? singleZoneAddAction(singleCardZoneOccupied && !isInActiveSingleZone)
        : {})}
      removeLabel={isInActiveSingleZone ? m.decks_editor_remove() : undefined}
      shiftHeld={shiftHeld}
      remainingCount={
        activeZone === WellKnown.deckZone.RUNES
          ? Math.max(0, RUNE_TARGET - runeTotal)
          : copyRemainderFor(printing.card, copyLimitTotalByCard.get(cardId) ?? 0)
      }
      onQuickAdd={handleQuickAdd}
      onRemove={handleRemove}
    />
  );
}

interface DeckCardBrowserProps {
  deckId: string;
  ownershipData?: DeckOwnershipData;
  marketplace: Marketplace;
  onZoneClick: (zone: DeckZone) => void;
  onViewMissing: () => void;
  onHoverCard?: HoverHandler;
  onOverviewCardClick: (card: CardOpenTarget) => void;
  onEditDescription?: () => void;
  variantRailSlot?: React.ReactNode;
  onTargetZone?: (zone: DeckZone) => void;
  cardListReadOnly?: boolean;
}

export function DeckCardBrowser({
  deckId,
  ownershipData,
  marketplace,
  onZoneClick,
  onViewMissing,
  onHoverCard,
  onOverviewCardClick,
  onEditDescription,
  variantRailSlot,
  onTargetZone,
  cardListReadOnly,
}: DeckCardBrowserProps) {
  const { data: deckDetail } = useDeckDetail(deckId);
  const activeZone = useDeckBuilderUiStore((state) => state.activeZone);
  const { filters } = useFilterValues();
  // Must stay here, not the inner browser: mounting per-zone would re-seed
  // and undo a user who cleared the language filter.
  useSeedLanguagesFromPrefs(filters.languages);

  const pickTag = needsFormatTagPick(deckDetail.deck);
  if (pickTag && !(cardListReadOnly && !activeZone)) {
    // pt-3 matches deck-overview's root so the banner isn't flush against the sticky bar.
    return (
      <div className="pt-3">
        <FormatTagPickBanner deck={deckDetail.deck} />
      </div>
    );
  }

  if (!activeZone) {
    return (
      <DeckOverviewForEditor
        deck={deckDetail.deck}
        ownershipData={ownershipData}
        marketplace={marketplace}
        onZoneClick={onZoneClick}
        onViewMissing={onViewMissing}
        onHoverCard={onHoverCard}
        onCardClick={onOverviewCardClick}
        onEditDescription={onEditDescription}
        variantRailSlot={variantRailSlot}
        cardListReadOnly={cardListReadOnly}
        cardListSlot={pickTag ? <FormatTagPickBanner deck={deckDetail.deck} /> : undefined}
      />
    );
  }

  return <DeckCardBrowserInner deckId={deckId} onTargetZone={onTargetZone} />;
}

const EMPTY_SIBLINGS: Printing[] = [];

function DeckOverviewForEditor({
  deck,
  ownershipData,
  marketplace,
  onZoneClick,
  onViewMissing,
  onHoverCard,
  onCardClick,
  onEditDescription,
  variantRailSlot,
  cardListReadOnly,
  cardListSlot,
}: Omit<DeckCardBrowserProps, "deckId" | "onOverviewCardClick" | "onTargetZone"> & {
  deck: DeckResponse;
  cardListSlot?: React.ReactNode;
  onCardClick: (card: CardOpenTarget) => void;
}) {
  const cards = useDeckCards(deck.id);
  const customTagAssignments = useCustomTagAssignments();
  const { getPreferredFrontImage } = usePreferredPrinting();
  const updateDeck = useUpdateDeck();
  const isLocal = useIsLocalDeck(deck.id);

  // Mirrors the parent editor's deckItems so arrow-key nav and the detail
  // pane's prev/next walk the same dedup'd visual-order list on both paths.
  const { items, printingsByCardId } = useDeckItems(cards);
  const selectedCard = useSelectionStore((state) => state.selectedCard);
  const siblingPrintings = selectedCard
    ? (printingsByCardId.get(selectedCard.cardId) ?? EMPTY_SIBLINGS)
    : EMPTY_SIBLINGS;
  useGridKeyboardNav({ items, siblingPrintings });

  return (
    <div className="flex flex-col">
      <DeckOverview
        deck={{
          id: deck.id,
          name: deck.name,
          format: deck.format,
          formatConfig: deck.formatConfig,
          coverCardId: deck.coverCardId,
          coverFaceId: deck.coverFaceId,
          coverPosition: deck.coverPosition,
          links: deck.links,
          collectionId: deck.collectionId,
        }}
        cards={cards}
        customTagAssignments={customTagAssignments}
        ownershipData={ownershipData}
        marketplace={marketplace}
        getThumbnail={(cardId, preferredPrintingId) => {
          const id = getPreferredFrontImage(cardId, preferredPrintingId)?.imageId;
          return id ? imageUrl(id, "400w") : undefined;
        }}
        onZoneClick={cardListReadOnly ? undefined : onZoneClick}
        cardListReadOnly={cardListReadOnly}
        cardListSlot={cardListSlot}
        onViewMissing={onViewMissing}
        onHoverCard={onHoverCard}
        onCardClick={onCardClick}
        description={deck.description ?? undefined}
        onEditDescription={onEditDescription}
        variantRailSlot={variantRailSlot}
        oddsConfig={isLocal ? undefined : (deck.oddsConfig ?? null)}
        onSaveOddsConfig={
          isLocal
            ? undefined
            : (config) => updateDeck.mutate({ deckId: deck.id, oddsConfig: config })
        }
        planSlot={
          isLocal ? undefined : (
            <Suspense
              fallback={
                <div className="text-muted-foreground p-4">{m.decks_editor_loading_plan()}</div>
              }
            >
              <DeckPlanEditor
                deckId={deck.id}
                deckCards={cards}
                format={deck.format}
                onHoverCard={onHoverCard}
              />
            </Suspense>
          )
        }
      />
    </div>
  );
}

function DeckCardBrowserInner({
  deckId,
  onTargetZone,
}: {
  deckId: string;
  onTargetZone?: (zone: DeckZone) => void;
}) {
  const { data: deckDetail } = useDeckDetail(deckId);
  const showImages = useDisplayStore((state) => state.showImages);
  const highlightOwned = useDisplayStore((state) => state.deckHighlightOwned);
  const toggleHighlightOwned = useDisplayStore((state) => state.toggleDeckHighlightOwned);
  const isMobile = useIsMobile();
  const { allPrintings, sets } = useCards();
  const channels = useChannelRegistry();
  const customTagAssignments = useCustomTagAssignments();
  const display = useCardThumbnailDisplay();
  const { data: session } = useSession();
  // The grid's "owned" badge reflects deck-available copies only: copies in
  // collections excluded from deck building don't feed the deck, except the
  // deck's own home collection.
  const { data: deckCounts } = useDeckBuildingCounts(
    Boolean(session?.user),
    deckDetail.deck.collectionId,
  );
  const ownedCountByPrinting = deckCounts?.available;

  const {
    filters: urlFilters,
    sortBy,
    sortDir,
    view: rawView,
    groupBy,
    groupDir,
    hasActiveFilters,
  } = useFilterValues();
  const { setSearch } = useFilterActions();
  const { getPreferredPrinting } = usePreferredPrinting();
  const { addCard, removeCard, setLegend, setQuantity } = useDeckBuilderActions(deckId);
  const isFreeform = deckDetail.deck.format === WellKnown.deckFormat.FREEFORM;
  const isCustomRegion = deckDetail.deck.format === WellKnown.deckFormat.CUSTOM_REGION;
  const formatTagConfig = getFormatTagConfig(deckDetail.deck.format);
  const visibleCustomTagCategories: ReadonlySet<string> | undefined = formatTagConfig
    ? new Set([formatTagConfig.category])
    : undefined;
  // The wrapper only renders this component when activeZone is set.
  const activeZone = useDeckBuilderUiStore((state) => state.activeZone) as DeckZone;
  const isSingleCardZone = !isFreeform && isSingleSlotZone(activeZone);

  const shiftHeld = useShiftHeld();

  const deckCards = useDeckCards(deckId);
  const singleCardZoneOccupied =
    isSingleCardZone && deckCards.some((card) => card.zone === activeZone);

  const workbench = useWorkbenchStore((state) => state.relaxed);
  const detailOpen = useSelectionStore((state) => state.detailOpen);
  const selectedCard = useSelectionStore((state) => state.selectedCard);
  const detailReplacesCatalog = workbench && !isMobile;
  const showCatalogDetail = detailReplacesCatalog && detailOpen && selectedCard !== null;
  const catalogReturn = useRef<{ scrollY: number; printingId: string } | null>(null);
  const openedPrintingId = showCatalogDetail ? selectedCard.printingId : null;
  // Layout effect: it must read the scroll position before the detail scrolls to the top.
  useLayoutEffect(() => {
    if (openedPrintingId !== null) {
      catalogReturn.current = {
        scrollY: catalogReturn.current?.scrollY ?? globalThis.scrollY,
        printingId: openedPrintingId,
      };
      return;
    }
    const pending = catalogReturn.current;
    if (!pending) {
      return;
    }
    catalogReturn.current = null;
    requestAnimationFrame(() => {
      globalThis.scrollTo({ top: pending.scrollY });
      focusCatalogCard(pending.printingId);
    });
  }, [openedPrintingId]);
  const showAllCardsZones = useWorkbenchStore((state) => state.showAllCardsZones);
  const setReplaceTarget = useWorkbenchStore((state) => state.setReplaceTarget);
  // Every deck edit rebuilds the zone preset; holding equal filters stops an add
  // from re-sorting the grid and dimming it as stale.
  const filters = useStableByValue(
    workbench && !showAllCardsZones.has(activeZone)
      ? applyZoneLayer(
          urlFilters,
          deckZoneFilterPreset(
            activeZone,
            deckCards,
            deckDetail.deck.format,
            deckDetail.deck.formatConfig,
          ),
        )
      : urlFilters,
  );

  // "copies" is a collection-only view; clamp to "printings" in the deck builder.
  const view = rawView === "copies" ? "printings" : rawView;
  const keywordReverseMap = useKeywordReverseMap();

  const {
    availableFilters,
    availableLanguages,
    sortedCards,
    printingsByCardId,
    priceRangeByCardId,
    ownedCounts,
    totalUniqueCards,
    setDisplayLabel,
    searchAlternatives,
  } = useCardData({
    allPrintings,
    sets,
    filters,
    ownedFilter: filters.ownedFilter,
    ownedCountMin: filters.ownedCountMin,
    ownedCountMax: filters.ownedCountMax,
    sortBy,
    sortDir,
    view,
    groupBy,
    ownedCountByPrinting,
    favoriteMarketplace: display.favoriteMarketplace,
    prices: display.prices,
    keywordReverseMap,
    channels,
    customTagAssignments,
  });

  const ownedCountBound = maxOwnedCount(
    allPrintings,
    ownedCountByPrinting ?? {},
    view === "printings" ? "printing" : "card",
  );

  const filteredCards = sortedCards;

  const deferredCards = useDeferredValue(filteredCards);
  const isGridStale = deferredCards !== filteredCards;

  const deckQuantityByCard = new Map<string, number>();
  for (const card of deckCards) {
    deckQuantityByCard.set(card.cardId, (deckQuantityByCard.get(card.cardId) ?? 0) + card.quantity);
  }

  const deckQuantityByCell = buildDeckQuantityByCell(
    deckCards,
    (cardId) => getPreferredPrinting(cardId)?.printingId,
  );
  const deckQtyForCell = (printing: Printing): number =>
    view === "printings"
      ? (deckQuantityByCell.get(deckCellKey(printing.cardId, printing.printingId)) ?? 0)
      : (deckQuantityByCard.get(printing.cardId) ?? 0);

  const items: CardViewerItem[] = deferredCards.map((printing) => ({
    id: sideKey(printing),
    printing,
  }));

  // A deck-list click indexes into the deck's items; the catalog's reconcile
  // would otherwise swap the detail to whatever catalog card sits at that index.
  useLayoutEffect(() => {
    if (showCatalogDetail && selectedCard !== null) {
      useSelectionStore.getState().reanchorSelection(items);
    }
  }, [showCatalogDetail, selectedCard, items]);

  // Must match useCardData's tile-splitting: when it renders one cell per
  // printing, click selection has to navigate by printing too.
  const cellRepresentsCard = view === "cards" && !splitsCardIntoTiles(groupBy);
  const findBy: "card" | "printing" = cellRepresentsCard ? "card" : "printing";

  const handleCardClick = (printing: Printing) => {
    useSelectionStore.getState().selectCard(printing, items, findBy);
  };

  const battlefieldsFull =
    activeZone === WellKnown.deckZone.BATTLEFIELD &&
    !isFreeform &&
    deckCards.filter((card) => card.zone === WellKnown.deckZone.BATTLEFIELD).length >=
      (isCustomRegion ? 1 : 3);

  // `event` is a structural `{ shiftKey?: boolean }` so the table path can
  // synthesize the bit it cares about without faking a full React.MouseEvent.
  const handleQuickAdd = (printing: Printing, event?: { shiftKey?: boolean }) => {
    const builderCard: DeckBuilderCard = {
      ...catalogCardToDeckBuilderCard(printing.cardId, printing.card),
      preferredPrintingId: cellPreferredPrintingId(
        view,
        printing.printingId,
        getPreferredPrinting(printing.cardId)?.printingId,
      ),
    };

    if (workbench && battlefieldsFull) {
      setReplaceTarget({
        cardId: builderCard.cardId,
        preferredPrintingId: builderCard.preferredPrintingId,
      });
      return;
    }
    if (workbench) {
      flyCardToDeck(printing.printingId, printing.cardId, activeZone);
    }
    if (activeZone === WellKnown.deckZone.LEGEND && !isFreeform) {
      setLegend(builderCard, buildRunesByDomain(allPrintings));
    } else {
      const count = event?.shiftKey
        ? isFreeform
          ? 3
          : activeZone === WellKnown.deckZone.RUNES
            ? Math.max(0, RUNE_TARGET - runeTotal)
            : 3
        : undefined;
      addCard(builderCard, activeZone, count);
    }
  };

  const handleRemove = (printing: Printing, event?: { shiftKey?: boolean }) => {
    const cardId = printing.cardId;
    const cellPrintingId =
      view === "printings"
        ? cellPreferredPrintingId(
            view,
            printing.printingId,
            getPreferredPrinting(cardId)?.printingId,
          )
        : undefined;
    const matchesCell = (card: DeckBuilderCard): boolean =>
      card.cardId === cardId &&
      (cellPrintingId === undefined || card.preferredPrintingId === cellPrintingId);

    if (event?.shiftKey) {
      for (const card of deckCards) {
        if (matchesCell(card)) {
          setQuantity(card.cardId, card.zone, 0, card.preferredPrintingId);
        }
      }
      return;
    }

    const inActiveZone = deckCards.find((card) => matchesCell(card) && card.zone === activeZone);
    if (inActiveZone) {
      removeCard(cardId, activeZone, cellPrintingId);
    } else {
      const anywhere = deckCards.find((card) => matchesCell(card));
      if (anywhere) {
        removeCard(cardId, anywhere.zone, cellPrintingId);
      }
    }
  };

  // Overflow is excluded: it's a free parking zone, so its copies don't count
  // toward the 3-copy cap that disables the browser's add button.
  const copyLimitTotalByCard = new Map<string, number>();
  for (const card of deckCards) {
    if (card.zone === WellKnown.deckZone.MAIN || card.zone === WellKnown.deckZone.SIDEBOARD) {
      copyLimitTotalByCard.set(
        card.cardId,
        (copyLimitTotalByCard.get(card.cardId) ?? 0) + card.quantity,
      );
    }
  }

  const runeTotal = totalQuantity(
    deckCards.filter((card) => card.zone === WellKnown.deckZone.RUNES),
  );

  useRowActionHandlers("deck", {
    onRowClick: handleCardClick,
  });

  const isMaxReached = (item: CardViewerItem): boolean => {
    if (isFreeform) {
      return false;
    }
    const cardId = item.printing.cardId;
    if (isSingleSlotZone(activeZone)) {
      return deckCards.some((card) => card.cardId === cardId && card.zone === activeZone);
    }
    if (activeZone === WellKnown.deckZone.BATTLEFIELD) {
      const alreadyInZone = deckCards.some(
        (card) => card.cardId === cardId && card.zone === WellKnown.deckZone.BATTLEFIELD,
      );
      const battlefieldCap = isCustomRegion ? 1 : 3;
      const zoneFull =
        deckCards.filter((card) => card.zone === WellKnown.deckZone.BATTLEFIELD).length >=
        battlefieldCap;
      return alreadyInZone || zoneFull;
    }
    if (activeZone === WellKnown.deckZone.LEGEND_OPTIONS) {
      return isDeckZoneFullForDrag({
        zone: activeZone,
        draggedCard: { cardId, maxCopiesOverride: item.printing.card.maxCopiesOverride },
        fromZone: null,
        allCards: deckCards,
        format: deckDetail.deck.format,
      });
    }
    if (activeZone === WellKnown.deckZone.RUNES) {
      return !canAddRune(catalogCardToDeckBuilderCard(cardId, item.printing.card), deckCards);
    }
    if (activeZone === WellKnown.deckZone.OVERFLOW) {
      // Free parking zone — never capped.
      return false;
    }
    return (copyLimitTotalByCard.get(cardId) ?? 0) >= copyLimitFor(item.printing.card);
  };

  const showSideboardAdd =
    activeZone !== WellKnown.deckZone.SIDEBOARD && formatHasSideboard(deckDetail.deck.format);
  const workbenchDetailActions = (printing: Printing) => {
    const deckQty = deckQtyForCell(printing);
    const owned = ownedCounts?.get(sideKey(printing)) ?? 0;
    const missing = Math.max(0, deckQty - owned);
    const deckEntries = deckCards.filter((card) => card.cardId === printing.cardId);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={
              isSingleCardZone &&
              deckCards.some((card) => card.cardId === printing.cardId && card.zone === activeZone)
            }
            onClick={() => handleQuickAdd(printing)}
          >
            <PlusIcon className="size-4" />
            {isSingleCardZone
              ? m.decks_workbench_detail_set_as({ zone: ZONE_LABELS[activeZone] })
              : m.decks_workbench_detail_add_to({ zone: ZONE_LABELS[activeZone] })}
          </Button>
          {showSideboardAdd && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                addCard(
                  {
                    ...catalogCardToDeckBuilderCard(printing.cardId, printing.card),
                    preferredPrintingId: cellPreferredPrintingId(
                      view,
                      printing.printingId,
                      getPreferredPrinting(printing.cardId)?.printingId,
                    ),
                  },
                  WellKnown.deckZone.SIDEBOARD,
                )
              }
            >
              <PlusIcon className="size-4" />
              {m.decks_workbench_detail_add_to({
                zone: ZONE_LABELS[WellKnown.deckZone.SIDEBOARD],
              })}
            </Button>
          )}
        </div>
        <DeckCardZoneSteppers
          entries={deckEntries}
          isFreeform={isFreeform}
          onAdd={(entry) => addCard(entry, entry.zone)}
          onRemove={(entry) => removeCard(entry.cardId, entry.zone, entry.preferredPrintingId)}
        />
        {ownedCounts && (
          <p className="text-muted-foreground tabular-nums">
            {[
              m.decks_editor_owned_count({ count: owned }),
              missing > 0 ? m.decks_workbench_detail_missing({ count: missing }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
    );
  };

  // Extracted so the detail overlay can show the same add controls for the
  // card it covers.
  const deckStripFor = (printing: Printing) => {
    const cardId = printing.cardId;
    const deckQty = deckQtyForCell(printing);
    // Keys off "in the active zone", not "anywhere in the deck": a champion
    // unit can sit in main as regular copies without being the chosen champion.
    const isInActiveSingleZone =
      isSingleCardZone &&
      deckCards.some((card) => card.cardId === cardId && card.zone === activeZone);

    const overLimit = isMaxReached({ id: sideKey(printing), printing });
    const workbenchWarn =
      workbench && overLimit && !isInActiveSingleZone
        ? workbenchLimitText(activeZone, battlefieldsFull)
        : undefined;
    return (
      <DeckAddStrip
        printing={printing}
        ownedCount={ownedCounts?.get(sideKey(printing)) ?? 0}
        deckQuantity={deckQty}
        maxReached={workbench ? isInActiveSingleZone : overLimit}
        warnLimit={workbenchWarn}
        hideDeckCount={workbench}
        {...(isSingleCardZone
          ? singleZoneAddAction(singleCardZoneOccupied && !isInActiveSingleZone)
          : workbench
            ? { addLabel: m.decks_overview_add(), addIcon: true }
            : {})}
        removeLabel={!workbench && isInActiveSingleZone ? m.decks_editor_remove() : undefined}
        shiftHeld={shiftHeld}
        remainingCount={
          isFreeform
            ? undefined
            : activeZone === WellKnown.deckZone.RUNES
              ? Math.max(0, RUNE_TARGET - runeTotal)
              : copyRemainderFor(printing.card, copyLimitTotalByCard.get(cardId) ?? 0)
        }
        onQuickAdd={handleQuickAdd}
        onRemove={workbench ? undefined : handleRemove}
      />
    );
  };

  const renderCard = (item: CardViewerItem, ctx: CardRenderContext) => {
    const cardId = item.printing.cardId;
    const ownedCount = ownedCounts?.get(sideKey(item.printing)) ?? 0;
    const deckQty = deckQtyForCell(item.printing);

    return (
      <CardCell
        printing={item.printing}
        ctx={ctx}
        display={display}
        showImages={showImages}
        view={view}
        onClick={isMobile ? handleQuickAdd : handleCardClick}
        priceRange={priceRangeByCardId?.get(cardId)}
        dimmed={highlightOwned && ownedCount === 0 && deckQty === 0}
        highlighted={!workbench && deckQty > 0}
        imageOverlay={workbench && deckQty > 0 ? <DeckCountMark /> : undefined}
        imageBadge={
          workbench && deckQty > 0 ? (
            <CardQuantityChip
              quantity={deckQty}
              title={m.decks_editor_in_deck_count({ count: deckQty })}
            />
          ) : undefined
        }
        banDisplay={isCustomRegion ? "none" : "overlay"}
        dragData={{
          type: "browser-card",
          card: {
            ...catalogCardToDeckBuilderCard(item.printing.cardId, item.printing.card),
            preferredPrintingId: cellPreferredPrintingId(
              view,
              item.printing.printingId,
              getPreferredPrinting(cardId)?.printingId,
            ),
          },
        }}
        dragId={`browser-card-${sideKey(item.printing)}`}
        strip={deckStripFor(item.printing)}
        contextMenu={<DeckCardDetailMenu onViewDetail={() => handleCardClick(item.printing)} />}
      />
    );
  };

  const toolbar = (
    <BrowserToolbar
      totalCards={totalUniqueCards}
      filteredCount={sortedCards.length}
      countBelowOnPhone
      mobileDoneLabel={
        hasActiveFilters ? m.decks_editor_show_cards({ count: sortedCards.length }) : undefined
      }
      extras={
        ownedCounts ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  variant="control"
                  pressed={highlightOwned}
                  onPressedChange={toggleHighlightOwned}
                  aria-label={m.decks_editor_highlight_owned()}
                  className="max-sm:w-(--control-h) max-sm:px-0"
                />
              }
            >
              <PackageCheckIcon className="size-4" />
              <span className="hidden sm:inline">{m.decks_editor_highlight_owned()}</span>
            </TooltipTrigger>
            <TooltipContent>{m.decks_editor_highlight_owned_title()}</TooltipContent>
          </Tooltip>
        ) : null
      }
    />
  );

  const rightPane = detailReplacesCatalog ? undefined : (
    <SelectionDetailPane
      items={items}
      printingsByCardId={printingsByCardId}
      showImages={showImages}
      onSearchAndClose={setSearch}
      actions={deckStripFor}
    />
  );

  return (
    <CardBrowserFilterProvider
      searchAlternatives={searchAlternatives}
      availableFilters={availableFilters}
      availableLanguages={availableLanguages}
      setDisplayLabel={setDisplayLabel}
      visibleCustomTagCategories={visibleCustomTagCategories}
      ownedCountMax={ownedCountBound}
    >
      {showCatalogDetail && (
        <WorkbenchCardDetail
          items={items}
          printingsByCardId={printingsByCardId}
          showImages={showImages}
          onSearchAndClose={setSearch}
          actions={workbenchDetailActions}
        />
      )}
      <div className={cn(showCatalogDetail && "hidden")}>
        <BrowserCardViewer
          items={items}
          totalItems={allPrintings.length}
          renderCard={renderCard}
          setOrder={sets}
          renderedCards={deferredCards}
          printingsByCardId={printingsByCardId}
          view={view}
          groupBy={groupBy}
          groupDir={groupDir}
          stale={isGridStale}
          toolbar={toolbar}
          aboveGrid={
            workbench && onTargetZone ? (
              <WorkbenchZoneBar deckId={deckId} zone={activeZone} onTargetZone={onTargetZone} />
            ) : undefined
          }
          rightPane={rightPane}
          addStripHeight={ADD_STRIP_HEIGHT}
          table={{
            actionsColumn: "wide",
            actionsLabel: m.decks_editor_table_actions_label(),
            actionsCell: (
              <DeckActionsCell
                view={view}
                deckQuantityByCard={deckQuantityByCard}
                deckQuantityByCell={deckQuantityByCell}
                isSingleCardZone={isSingleCardZone}
                singleCardZoneOccupied={singleCardZoneOccupied}
                deckCards={deckCards}
                activeZone={activeZone}
                isMaxReached={isMaxReached}
                shiftHeld={shiftHeld}
                runeTotal={runeTotal}
                copyLimitTotalByCard={copyLimitTotalByCard}
                handleQuickAdd={handleQuickAdd}
                handleRemove={handleRemove}
              />
            ),
          }}
        >
          {!detailReplacesCatalog && (
            <SelectionDetailOverlays
              items={items}
              printingsByCardId={printingsByCardId}
              showImages={showImages}
              onSearchAndClose={setSearch}
              actions={deckStripFor}
            />
          )}
        </BrowserCardViewer>
      </div>
    </CardBrowserFilterProvider>
  );
}
