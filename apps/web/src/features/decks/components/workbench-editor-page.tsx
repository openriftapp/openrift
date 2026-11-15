import { totalQuantity } from "@openrift/shared/deck-rules";
import { isZoneShown, requiredZoneProgress } from "@openrift/shared/deck-zones";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { FlaskConicalIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
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
import { SelectionDetailOverlays } from "@/features/cards/components/selection-detail-overlays";
import {
  closeOverlayHistoryEntry,
  hasOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { DeckCardBrowser } from "@/features/decks/components/deck-card-browser";
import { DeckDndContext } from "@/features/decks/components/deck-dnd-context";
import { DeckEditorDialogs } from "@/features/decks/components/deck-editor-dialogs";
import { DeckEditorTopBar } from "@/features/decks/components/deck-editor-top-bar";
import { DeckMobileDock } from "@/features/decks/components/deck-mobile-dock";
import { useDeckUndoShortcuts } from "@/features/decks/components/deck-undo-controls";
import { DeckVariantRail } from "@/features/decks/components/deck-variant-rail";
import { DeckZoneDrawer } from "@/features/decks/components/deck-zone-drawer";
import { DeckZonePanel } from "@/features/decks/components/deck-zone-panel";
import { useViewDeckCardDetail } from "@/features/decks/components/use-view-deck-card-detail";
import { WorkbenchDialogs } from "@/features/decks/components/workbench-dialogs";
import { WorkbenchModeControl } from "@/features/decks/components/workbench-mode-control";
import { WorkbenchStatsStrip } from "@/features/decks/components/workbench-stats-strip";
import { WorkbenchAddAnnouncer } from "@/features/decks/components/workbench-zone-bar";
import { useDeckEditorDialogs } from "@/features/decks/hooks/use-deck-editor-dialogs";
import { useDeckEditorSession } from "@/features/decks/hooks/use-deck-editor-session";
import { useDeckHoverPreview } from "@/features/decks/hooks/use-deck-hover-preview";
import type { WorkbenchMode } from "@/features/decks/lib/deck-editor-search";
import { dismissRelaxedAddToasts } from "@/features/decks/lib/workbench-add-toast";
import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { useDisplayLanguages } from "@/hooks/use-display-languages";
import { useHeaderHeight } from "@/hooks/use-header-height";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { useSetOwnFeatureFlag } from "@/hooks/use-own-feature-flag";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { prefersReducedMotion } from "@/lib/media-query";
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
  const {
    data,
    isLocal,
    hydrated,
    deckCards,
    saveStatus,
    deckCounts,
    ownershipData,
    marketplace,
    editorViolations,
    deckItems,
    printingsByCardId,
    openOverviewCard,
  } = useDeckEditorSession(deckId);
  const { isMobile, setOpenMobile } = useSidebar();
  const setActiveZone = useDeckBuilderUiStore((state) => state.setActiveZone);
  const setOverviewTab = useDeckBuilderUiStore((state) => state.setOverviewTab);
  const setRelaxed = useWorkbenchStore((state) => state.setRelaxed);
  const resetWorkbench = useWorkbenchStore((state) => state.reset);
  const setDismissedAdvance = useWorkbenchStore((state) => state.setDismissedAdvance);
  const openQuickAdd = useCommandPaletteStore((state) => state.openQuickAdd);
  const setOwnFlag = useSetOwnFeatureFlag();
  const dialogs = useDeckEditorDialogs();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const router = useRouter();

  const viewDeckBuilding = useViewDeckCardDetail({ deck: data.deck, deckCounts, ownershipData });

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
  useDeckUndoShortcuts(deckId, mode === "build");
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

  const preferredLanguages = useDisplayLanguages();
  const viewPrintingsByCardId =
    preferredLanguages.length === 0
      ? printingsByCardId
      : new Map(
          [...printingsByCardId].map(([cardId, printings]) => [
            cardId,
            printings.filter((printing) => preferredLanguages.includes(printing.language)),
          ]),
        );
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
    if (!useCommandPaletteStore.getState().quickAddOpen) {
      region?.focus({ preventScroll: true });
    }
    if (!prefersReducedMotion()) {
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

  const quickAddOpen = useCommandPaletteStore((state) => state.quickAddOpen);
  const enterBuildForQuickAdd = useEffectEvent(() => {
    if (mode === "deck") {
      setMode("build");
    }
  });
  useEffect(() => {
    if (quickAddOpen) {
      enterBuildForQuickAdd();
    }
  }, [quickAddOpen]);

  const handleOpenPlan = () => {
    setOverviewTab("plan");
    setMode("deck");
  };

  const {
    hoveredCard,
    origin: hoverOrigin,
    containerRef,
    handleHoverSidebar,
    handleHoverMain,
  } = useDeckHoverPreview({
    mainOrigin: mode === "deck" ? "main-right" : "main",
    disabled: isMobile,
    suppressMain: detailOpen,
  });

  const zonePanel = (inDrawer: boolean) => (
    <DeckZonePanel
      deckId={deckId}
      onZoneClick={setZone}
      onZoneAdd={setZone}
      onOpenPlan={isLocal ? undefined : handleOpenPlan}
      onHoverCard={handleHoverSidebar}
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
      {mode === "build" && (
        <DropdownMenuItem onClick={() => openQuickAdd("add")}>
          <PlusIcon className="size-4" />
          {m.decks_editor_add_card()}
        </DropdownMenuItem>
      )}
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
      onHoverCard={handleHoverMain}
      onOverviewCardClick={openOverviewCard}
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
                            pending={setOwnFlag.isPending}
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
              viewing: mode === "deck",
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
            origin={hoverOrigin}
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
              <div className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-gutter:stable] overflow-y-auto overscroll-contain py-1 pr-4 pl-3">
                {zonePanel(false)}
              </div>
              <WorkbenchStatsStrip deckId={deckId} />
            </aside>
          )}
        </div>
        {mode === "deck" && (
          <SelectionDetailOverlays
            items={deckItems}
            printingsByCardId={viewPrintingsByCardId}
            showImages={showImages}
            onSearchAndClose={noop}
            docking={false}
            deckBuilding={viewDeckBuilding}
          />
        )}
        {isMobile && mode === "build" && <DeckMobileDock deckId={deckId} zone={zone} />}
      </DeckDndContext>
    </div>
  );
}
