import { getOrientation } from "@openrift/shared/card-orientation";
import { totalQuantity } from "@openrift/shared/deck-rules";
import { isZoneShown, requiredZoneProgress } from "@openrift/shared/deck-zones";
import { imageUrl } from "@openrift/shared/image-url";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { FlaskConicalIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Footer } from "@/components/layout/footer";
import {
  PAGE_TOP_BAR_STICKY,
  PageTopBarButton,
  PageTopBarHeightContext,
  usePageTopBarHeight,
} from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoveredCardPreview } from "@/features/cards/components/hovered-card-preview";
import type { HoverOrigin } from "@/features/cards/components/hovered-card-preview";
import { SelectionDetailOverlays } from "@/features/cards/components/selection-detail-overlays";
import { useCards } from "@/features/cards/hooks/use-cards";
import {
  closeOverlayHistoryEntry,
  hasOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import type { CardOpenTarget } from "@/features/cards/lib/card-row-interactions";
import { useDeckBuildingCounts } from "@/features/collections/hooks/use-owned-count";
import { DeckCardBrowser } from "@/features/decks/components/deck-card-browser";
import { DeckDndContext } from "@/features/decks/components/deck-dnd-context";
import { DeckEditorDialogs } from "@/features/decks/components/deck-editor-dialogs";
import { DeckEditorTopBar } from "@/features/decks/components/deck-editor-top-bar";
import { DeckMobileDock } from "@/features/decks/components/deck-mobile-dock";
import { useDeckUndoShortcuts } from "@/features/decks/components/deck-undo-controls";
import { DeckVariantRail } from "@/features/decks/components/deck-variant-rail";
import { DeckZoneDrawer } from "@/features/decks/components/deck-zone-drawer";
import { DeckZonePanel } from "@/features/decks/components/deck-zone-panel";
import { WorkbenchDialogs } from "@/features/decks/components/workbench-dialogs";
import { WorkbenchModeControl } from "@/features/decks/components/workbench-mode-control";
import { WorkbenchStatsStrip } from "@/features/decks/components/workbench-stats-strip";
import { WorkbenchAddAnnouncer } from "@/features/decks/components/workbench-zone-bar";
import { useDeckCards, useDeckViolations } from "@/features/decks/hooks/use-deck-builder";
import { useDeckDraftHydrated, useDeckSaveStatus } from "@/features/decks/hooks/use-deck-draft";
import { useDeckEditorDialogs } from "@/features/decks/hooks/use-deck-editor-dialogs";
import { useDeckItems } from "@/features/decks/hooks/use-deck-items";
import { useDeckOwnership } from "@/features/decks/hooks/use-deck-ownership";
import { useDeckDetail } from "@/features/decks/hooks/use-decks";
import { useIsLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { toDeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { WorkbenchMode } from "@/features/decks/lib/deck-editor-search";
import { buildRunesByDomain } from "@/features/decks/lib/deck-runes-by-domain";
import { dismissRelaxedAddToasts } from "@/features/decks/lib/workbench-add-toast";
import { useDeckBenchSessionStore } from "@/features/decks/stores/deck-bench-session-store";
import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import { flushDeckDraft, hydrateDeckDraft } from "@/features/decks/stores/deck-draft-store";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { useIncomingTradeCounts } from "@/features/groups/hooks/use-card-trades";
import { useBorrowedCounts } from "@/features/groups/hooks/use-loans";
import { useRegisterQuickAdd } from "@/hooks/use-command-palette";
import { useHeaderHeight } from "@/hooks/use-header-height";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { useSetOwnFeatureFlag } from "@/hooks/use-own-feature-flag";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { useSession, useUserId } from "@/hooks/use-session";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useDisplayStore } from "@/stores/display-store";
import { useSelectionStore } from "@/stores/selection-store";

declare module "@tanstack/react-router" {
  interface HistoryState {
    workbenchModeEntry?: string;
  }
}

const route = getRouteApi("/_app/decks/$deckId");
const noop = () => null;

export function WorkbenchEditorPage({ deckId }: { deckId: string }) {
  const [topBarSlot, setTopBarSlot] = useState<HTMLDivElement | null>(null);
  const topBarHeight = useMeasuredHeight(topBarSlot);

  return (
    <PageTopBarHeightContext value={topBarHeight}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={setTopBarSlot} className={PAGE_TOP_BAR_STICKY} />
        <SidebarProvider defaultOpen={false}>
          <WorkbenchContent deckId={deckId} topBarSlot={topBarSlot} />
        </SidebarProvider>
      </div>
    </PageTopBarHeightContext>
  );
}

function isZone(value: string | undefined, zones: readonly DeckZone[]): value is DeckZone {
  return value !== undefined && (zones as readonly string[]).includes(value);
}

function WorkbenchContent({
  deckId,
  topBarSlot,
}: {
  deckId: string;
  topBarSlot: HTMLDivElement | null;
}) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const isLocal = useIsLocalDeck(deckId);
  const scope = isLocal ? "local" : (userId ?? "");
  const { data } = useDeckDetail(deckId);
  const { cardsById, allPrintings } = useCards();
  const { getPreferredPrinting } = usePreferredPrinting();
  const hydrated = useDeckDraftHydrated(queryClient, scope, deckId);
  const deckCards = useDeckCards(deckId);
  const saveStatus = useDeckSaveStatus(queryClient, scope, deckId);
  const { isMobile, setOpenMobile } = useSidebar();
  const setActiveZone = useDeckBuilderUiStore((state) => state.setActiveZone);
  const resetUi = useDeckBuilderUiStore((state) => state.reset);
  const setRunesByDomain = useDeckBuilderUiStore((state) => state.setRunesByDomain);
  const setRelaxed = useWorkbenchStore((state) => state.setRelaxed);
  const resetWorkbench = useWorkbenchStore((state) => state.reset);
  const setDismissedAdvance = useWorkbenchStore((state) => state.setDismissedAdvance);
  const openQuickAdd = useCommandPaletteStore((state) => state.openQuickAdd);
  const setOwnFlag = useSetOwnFeatureFlag();
  const dialogs = useDeckEditorDialogs();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const router = useRouter();

  const { data: session } = useSession();
  const { data: deckCounts } = useDeckBuildingCounts(
    Boolean(session?.user),
    data.deck.collectionId,
  );
  const { data: borrowedCounts } = useBorrowedCounts(Boolean(session?.user));
  const { data: incomingCounts } = useIncomingTradeCounts(Boolean(session?.user));
  const marketplaceOrder = useDisplayStore((state) => state.marketplaceOrder);
  const marketplace = marketplaceOrder[0];
  const editorViolations = useDeckViolations(deckId, data.deck.format, data.deck.formatConfig);
  useDeckUndoShortcuts(deckId);
  useRegisterQuickAdd({ key: `deck:${deckId}`, label: m.decks_editor_quick_add_label() });
  const ownershipData = useDeckOwnership(
    deckCards,
    allPrintings,
    deckCounts?.available,
    marketplace,
    deckCounts?.locked,
    borrowedCounts,
    deckCounts && {
      loaned: deckCounts.lockedLoaned,
      reserved: deckCounts.lockedReserved,
      excluded: deckCounts.lockedExcluded,
    },
    incomingCounts,
  );

  const hasLegend = deckCards.some((card) => card.zone === WellKnown.deckZone.LEGEND);
  const [opening, setOpening] = useState<{ mode: WorkbenchMode; zone: DeckZone } | null>(null);
  if (hydrated && opening === null) {
    setOpening(
      hasLegend
        ? { mode: "deck", zone: WellKnown.deckZone.MAIN }
        : { mode: "build", zone: WellKnown.deckZone.LEGEND },
    );
  }
  const openingMode = opening?.mode ?? null;
  const mode: WorkbenchMode = search.editor ?? openingMode ?? "deck";
  const shownZones = Object.values(WellKnown.deckZone).filter((zone) =>
    isZoneShown(zone, data.deck.format, deckCards),
  );
  const targetHidden = search.target !== undefined && !isZone(search.target, shownZones);
  const zone: DeckZone = isZone(search.target, shownZones)
    ? search.target
    : targetHidden
      ? WellKnown.deckZone.MAIN
      : (opening?.zone ?? WellKnown.deckZone.MAIN);
  const activeZone = mode === "build" ? zone : null;

  useEffect(() => {
    if (targetHidden) {
      void navigate({
        search: (prev) => ({ ...prev, target: WellKnown.deckZone.MAIN }),
        state: (prev) => prev,
        replace: true,
      });
    }
  }, [targetHidden, navigate]);

  // Layout effects: the first paint must already show the target zone and relaxed rules.
  useLayoutEffect(() => {
    setRelaxed(true);
    return () => {
      resetWorkbench();
      dismissRelaxedAddToasts();
    };
  }, [setRelaxed, resetWorkbench]);

  useLayoutEffect(() => {
    setActiveZone(activeZone);
  }, [activeZone, setActiveZone]);

  useEffect(() => {
    if (allPrintings.length === 0) {
      return;
    }
    setRunesByDomain(buildRunesByDomain(allPrintings));
  }, [allPrintings, setRunesByDomain]);

  useEffect(() => {
    if (data && !hydrated) {
      const builderCards = data.cards
        .map((card) => toDeckBuilderCard(card, cardsById))
        .filter((card): card is DeckBuilderCard => card !== null);
      hydrateDeckDraft(queryClient, scope, deckId, builderCards);
    }
  }, [data, deckId, hydrated, queryClient, scope, cardsById]);

  useEffect(
    () => () => {
      resetUi();
    },
    [resetUi],
  );

  useEffect(
    () => () => {
      flushDeckDraft(queryClient, scope, deckId);
    },
    [queryClient, scope, deckId],
  );

  const clearBenchSession = useDeckBenchSessionStore((state) => state.clear);
  useEffect(() => () => clearBenchSession(deckId), [clearBenchSession, deckId]);

  const unsavedWarning = saveStatus.isDirty || saveStatus.isSaving;
  useEffect(() => {
    if (!unsavedWarning) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    globalThis.addEventListener("beforeunload", handler);
    return () => globalThis.removeEventListener("beforeunload", handler);
  }, [unsavedWarning]);

  const { items: deckItems, printingsByCardId } = useDeckItems(deckCards);
  const showImages = useDisplayStore((state) => state.showImages);
  const detailOpen = useSelectionStore((state) => state.detailOpen);
  const topBarHeight = usePageTopBarHeight();
  const headerHeight = useHeaderHeight();

  useScopeEffect(activeZone, () => {
    useSelectionStore.getState().closeDetail();
  });

  const modeEntry = useRef<string | null>(null);
  const modeRegionRef = useRef<HTMLDivElement>(null);
  const shownMode = useRef(mode);
  useEffect(() => {
    if (shownMode.current === mode) {
      return;
    }
    shownMode.current = mode;
    const region = modeRegionRef.current;
    region?.focus({ preventScroll: true });
    if (!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      region?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
    }
  }, [mode]);
  // The sheet's history entry must be popped before navigating, or Back would land on it.
  const afterSheetClosed = (run: () => void) => {
    if (isMobile && hasOverlayHistoryEntry("deckSheet")) {
      closeOverlayHistoryEntry("deckSheet", () => setOpenMobile(false), run);
      return;
    }
    if (isMobile) {
      setOpenMobile(false);
    }
    run();
  };

  const setMode = (next: WorkbenchMode) => afterSheetClosed(() => switchMode(next));
  const switchMode = (next: WorkbenchMode) => {
    if (next === openingMode) {
      const token = modeEntry.current;
      modeEntry.current = null;
      if (token && router.latestLocation.state.workbenchModeEntry === token) {
        globalThis.history.back();
      } else {
        void navigate({ search: (prev) => ({ ...prev, editor: next }), replace: true });
      }
    } else {
      const token = String(Date.now());
      modeEntry.current = token;
      void navigate({
        search: (prev) => ({ ...prev, editor: next }),
        state: (prev) => ({ ...prev, workbenchModeEntry: token }),
      });
    }
  };

  const setZone = (next: DeckZone) => afterSheetClosed(() => switchZone(next));
  const switchZone = (next: DeckZone) => {
    setDismissedAdvance(null);
    const nextSearch = (prev: typeof search) => ({
      ...prev,
      editor: "build" as const,
      target: next,
    });
    if (mode === "build" || openingMode === "build") {
      modeEntry.current = mode === "build" ? modeEntry.current : null;
      void navigate({ search: nextSearch, state: (prev) => prev, replace: true });
    } else {
      const token = String(Date.now());
      modeEntry.current = token;
      void navigate({
        search: nextSearch,
        state: (prev) => ({ ...prev, workbenchModeEntry: token }),
      });
    }
  };

  const handleOverviewCardClick = (card: CardOpenTarget) => {
    const printing = getPreferredPrinting(card.cardId, card.preferredPrintingId);
    if (!printing) {
      return;
    }
    useSelectionStore.getState().selectCard(printing, deckItems, "card", { zone: card.zone });
  };

  const [hovered, setHovered] = useState<{
    id: string;
    origin: HoverOrigin;
    preferredPrintingId: string | null;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const setHoveredSidebar = (id: string | null, preferredPrintingId?: string | null) =>
    setHovered(
      id ? { id, origin: "sidebar", preferredPrintingId: preferredPrintingId ?? null } : null,
    );
  const setHoveredMain = (id: string | null, preferredPrintingId?: string | null) =>
    setHovered(
      id
        ? {
            id,
            origin: mode === "deck" ? "main-right" : "main",
            preferredPrintingId: preferredPrintingId ?? null,
          }
        : null,
    );
  const suppressHoverPreview =
    detailOpen && (hovered?.origin === "main" || hovered?.origin === "main-right");
  const hoveredPrinting =
    hovered && !isMobile && !suppressHoverPreview
      ? (getPreferredPrinting(hovered.id, hovered.preferredPrintingId) ?? null)
      : null;
  const hoveredFrontImage = hoveredPrinting?.images[0] ?? null;
  const hoveredCard =
    hoveredPrinting && hoveredFrontImage
      ? {
          thumbnailUrl: imageUrl(hoveredFrontImage.imageId, "400w"),
          fullUrl: imageUrl(hoveredFrontImage.imageId, "full"),
          landscape: getOrientation(hoveredPrinting.card.types) === "landscape",
        }
      : null;

  const zonePanel = (inDrawer: boolean) => (
    <DeckZonePanel
      deckId={deckId}
      onZoneClick={setZone}
      onZoneAdd={setZone}
      onHoverCard={setHoveredSidebar}
      ownershipData={ownershipData}
      hideStats
      hideIdentityHeader={inDrawer}
      deckItems={deckItems}
      workbench
    />
  );

  const zoneCount = totalQuantity(deckCards.filter((card) => card.zone === zone));
  const requiredCounts = requiredZoneProgress(deckCards, data.deck.format);

  if (!hydrated) {
    return null;
  }

  const menuPrefix = (
    <>
      <DropdownMenuItem onClick={() => openQuickAdd("add")}>
        <PlusIcon className="size-4" />
        {m.decks_editor_add_card()}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => setOwnFlag.mutate({ key: "deck-builder-beta", enabled: false })}
      >
        <FlaskConicalIcon className="size-4" />
        {m.decks_workbench_back_to_classic()}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );

  const catalog = (
    <DeckCardBrowser
      deckId={deckId}
      ownershipData={ownershipData}
      marketplace={marketplace}
      onZoneClick={setZone}
      onViewMissing={() => dialogs.openDialog("missing")}
      onHoverCard={setHoveredMain}
      onOverviewCardClick={handleOverviewCardClick}
      onEditDescription={isLocal ? undefined : () => dialogs.openDialog("details")}
      variantRailSlot={isLocal ? undefined : <DeckVariantRail deckId={deckId} />}
      onTargetZone={setZone}
      cardListReadOnly={mode === "deck"}
    />
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {topBarSlot &&
        createPortal(
          <DeckEditorTopBar
            deckId={deckId}
            deck={data.deck}
            cards={deckCards}
            isLocal={isLocal}
            activeZone={activeZone}
            zoneCount={zoneCount}
            requiredProgress={requiredCounts}
            hasViolations={editorViolations.length > 0}
            openDialog={dialogs.openDialog}
            workbench={{
              modeControl: (
                <>
                  {!isMobile && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <PageTopBarButton
                            disabled={setOwnFlag.isPending}
                            onClick={() =>
                              setOwnFlag.mutate({ key: "deck-builder-beta", enabled: false })
                            }
                          />
                        }
                      >
                        <FlaskConicalIcon className="size-4" />
                        {m.decks_workbench_classic_editor()}
                      </TooltipTrigger>
                      <TooltipContent>{m.decks_workbench_back_to_classic()}</TooltipContent>
                    </Tooltip>
                  )}
                  <WorkbenchModeControl mode={mode} isMobile={isMobile} onModeChange={setMode} />
                </>
              ),
              menuPrefix,
            }}
          />,
          topBarSlot,
        )}
      <DeckEditorDialogs
        deckId={deckId}
        deck={data.deck}
        cards={deckCards}
        isLocal={isLocal}
        isDirty={saveStatus.isDirty}
        ownershipData={ownershipData}
        marketplace={marketplace}
        dialogs={dialogs}
      />
      <WorkbenchDialogs deckId={deckId} />
      <WorkbenchAddAnnouncer deckId={deckId} />
      <DeckDndContext deckId={deckId}>
        <div
          ref={containerRef}
          className={cn(PAGE_WIDTH.full, "px-safe relative flex gap-4")}
          style={
            {
              "--sticky-top": `${headerHeight + topBarHeight}px`,
            } as React.CSSProperties
          }
        >
          {isMobile && mode === "build" && (
            <DeckZoneDrawer deckId={deckId} target={zone}>
              {zonePanel(true)}
              <div className="pt-3 pb-2">
                <WorkbenchStatsStrip deckId={deckId} compact />
              </div>
            </DeckZoneDrawer>
          )}
          <HoveredCardPreview
            hoveredCard={hoveredCard}
            origin={hovered?.origin ?? "sidebar"}
            containerRef={containerRef}
          />
          <div className="flex min-w-0 flex-1 flex-col pb-3">
            <div className="@container flex flex-1 items-stretch gap-6">
              <div
                ref={modeRegionRef}
                tabIndex={-1}
                role="region"
                aria-label={
                  mode === "build" ? m.decks_workbench_mode_build() : m.decks_workbench_mode_deck()
                }
                className={cn(
                  "flex min-w-0 flex-1 flex-col outline-none",
                  isMobile && mode === "build" && "pb-20",
                )}
              >
                {catalog}
                {mode === "deck" && (
                  <div className="mb-8 flex justify-center pt-6">
                    <Button variant="outline" onClick={() => setMode("build")}>
                      <PencilIcon className="size-4" />
                      {m.decks_workbench_edit_deck()}
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Footer />
          </div>
          {!isMobile && mode === "build" && (
            <aside
              data-deck-preview-anchor
              aria-label={m.decks_workbench_deck_column()}
              className="motion-safe:animate-in motion-safe:fade-in-0 sticky top-(--sticky-top) z-30 flex h-[calc(100dvh-var(--sticky-top))] w-[260px] shrink-0 flex-col gap-3 pb-3 motion-safe:duration-150 min-[1200px]:w-[340px] lg:w-[300px]"
            >
              <div className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-gutter:stable] overflow-y-auto overscroll-contain py-1 pr-4 pl-2">
                {zonePanel(false)}
              </div>
              <WorkbenchStatsStrip deckId={deckId} />
            </aside>
          )}
        </div>
        {mode === "deck" && (
          <SelectionDetailOverlays
            items={deckItems}
            printingsByCardId={printingsByCardId}
            showImages={showImages}
            onSearchAndClose={noop}
            docking={false}
          />
        )}
        {isMobile && mode === "build" && <DeckMobileDock deckId={deckId} zone={zone} />}
      </DeckDndContext>
    </div>
  );
}
