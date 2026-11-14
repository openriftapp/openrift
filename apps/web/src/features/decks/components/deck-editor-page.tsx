import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { totalQuantity } from "@openrift/shared/deck-rules";
import { isZoneShown, requiredZoneProgress } from "@openrift/shared/deck-zones";
import type { DeckZone } from "@openrift/shared/types/enums";
import { CornerLeftUpIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Footer } from "@/components/layout/footer";
import {
  PAGE_TOP_BAR_STICKY,
  PageTopBarHeightContext,
  usePageTopBarHeight,
} from "@/components/layout/page-top-bar";
import { PROSE_MARKUP } from "@/components/message-markup";
import {
  NestedSidebar,
  SidebarContent,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { HoveredCardPreview } from "@/features/cards/components/hovered-card-preview";
import { SelectionDetailOverlays } from "@/features/cards/components/selection-detail-overlays";
import { SelectionDetailPane } from "@/features/cards/components/selection-detail-pane";
import { useFilterActions } from "@/features/cards/hooks/use-card-filters";
import { DeckCardBrowser } from "@/features/decks/components/deck-card-browser";
import { DeckDndContext } from "@/features/decks/components/deck-dnd-context";
import { DeckEditorDialogs } from "@/features/decks/components/deck-editor-dialogs";
import { DeckEditorTopBar } from "@/features/decks/components/deck-editor-top-bar";
import { DeckMobileDock } from "@/features/decks/components/deck-mobile-dock";
import { useDeckUndoShortcuts } from "@/features/decks/components/deck-undo-controls";
import { DeckVariantRail } from "@/features/decks/components/deck-variant-rail";
import { DeckZoneDrawer } from "@/features/decks/components/deck-zone-drawer";
import { DeckZonePanel } from "@/features/decks/components/deck-zone-panel";
import { WorkbenchOptInBanner } from "@/features/decks/components/workbench-opt-in-banner";
import { useDeckEditorDialogs } from "@/features/decks/hooks/use-deck-editor-dialogs";
import { useDeckEditorSession } from "@/features/decks/hooks/use-deck-editor-session";
import { useDeckHoverPreview } from "@/features/decks/hooks/use-deck-hover-preview";
import { deckZoneFilterPreset } from "@/features/decks/lib/deck-zone-filters";
import { useDeckBuilderUiStore } from "@/features/decks/stores/deck-builder-ui-store";
import { useHeaderHeight } from "@/hooks/use-header-height";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";
import { useSelectionStore } from "@/stores/selection-store";

interface DeckEditorPageProps {
  deckId: string;
}

export function DeckEditorPage({ deckId }: DeckEditorPageProps) {
  const [topBarSlot, setTopBarSlot] = useState<HTMLDivElement | null>(null);
  const topBarHeight = useMeasuredHeight(topBarSlot);

  return (
    <PageTopBarHeightContext value={topBarHeight}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={setTopBarSlot} className={PAGE_TOP_BAR_STICKY} />
        <SidebarProvider defaultOpen>
          <DeckEditorContent deckId={deckId} topBarSlot={topBarSlot} />
        </SidebarProvider>
      </div>
    </PageTopBarHeightContext>
  );
}

function DeckEditorContent({
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
    ownershipData,
    marketplace,
    editorViolations,
    deckItems,
    printingsByCardId,
    openOverviewCard,
  } = useDeckEditorSession(deckId);
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const activeZone = useDeckBuilderUiStore((state) => state.activeZone);
  const setActiveZone = useDeckBuilderUiStore((state) => state.setActiveZone);
  const setOverviewTab = useDeckBuilderUiStore((state) => state.setOverviewTab);
  const dialogs = useDeckEditorDialogs();
  // Ctrl+Z / Ctrl+Shift+Z over the whole editor; mounted here (not in a
  // conditional subtree) so the shortcuts survive zone and tab switches.
  useDeckUndoShortcuts(deckId);

  const { setArrayFilters, setRanges, setSearch } = useFilterActions();

  const showImages = useDisplayStore((state) => state.showImages);
  const detailOpen = useSelectionStore((state) => state.detailOpen);
  // Not `use(PageTopBarHeightContext)`: must stay at its pre-measurement 0
  // while the subtree hydrates, since it feeds an inline --sticky-top below.
  const topBarHeight = usePageTopBarHeight();
  const headerHeight = useHeaderHeight();

  // Switching between overview and zone mode swaps the items array under the
  // detail pane (deck items vs catalog items), so clear the selection at the
  // boundary to avoid an orphaned selectedIndex.
  useScopeEffect(activeZone, () => {
    useSelectionStore.getState().closeDetail();
  });

  // A hidden zone must not keep the browser targeting an unrendered section.
  const activeZoneHidden =
    activeZone !== null && !isZoneShown(activeZone, data.deck.format, deckCards);
  useEffect(() => {
    if (activeZoneHidden) {
      setActiveZone(null);
    }
  }, [activeZoneHidden, setActiveZone]);

  const handleZoneClick = (zone: DeckZone) => {
    // Clicking the active zone again returns to the overview dashboard.
    if (zone === activeZone) {
      setActiveZone(null);
      setSearch("");
      if (isMobile) {
        setOpenMobile(false);
      }
      return;
    }

    const preset = deckZoneFilterPreset(zone, deckCards, data.deck.format, data.deck.formatConfig);
    setSearch(preset.search);
    setArrayFilters(preset.arrayFilters);
    if (preset.clearStatRanges) {
      setRanges({ energy: null, might: null, power: null });
    }

    setActiveZone(zone);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Overview hovers dock the preview at the right edge ("main-right") instead
  // of chasing the cursor; the zone browser keeps the cursor-following float.
  const {
    hoveredCard,
    origin: hoverOrigin,
    containerRef,
    handleHoverSidebar,
    handleHoverMain,
  } = useDeckHoverPreview({
    mainOrigin: activeZone === null ? "main-right" : "main",
    disabled: isMobile,
    suppressMain: detailOpen,
  });

  const handleZoneAdd = (zone: DeckZone) => {
    if (zone !== activeZone) {
      handleZoneClick(zone);
    } else if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleOverviewClick = () => {
    setActiveZone(null);
    setOverviewTab("overview");
  };

  const handleOpenPlan = () => {
    setActiveZone(null);
    setOverviewTab("plan");
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const zonePanel = (inDrawer: boolean) => (
    <DeckZonePanel
      deckId={deckId}
      onZoneClick={handleZoneClick}
      onZoneAdd={handleZoneAdd}
      onOverviewClick={handleOverviewClick}
      onOpenPlan={isLocal ? undefined : handleOpenPlan}
      onHoverCard={handleHoverSidebar}
      ownershipData={ownershipData}
      hideStats={activeZone === null}
      hideIdentityHeader={inDrawer}
      overviewShowing={activeZone === null}
      deckItems={deckItems}
    />
  );

  const zoneCount = totalQuantity(deckCards.filter((card) => card.zone === activeZone));
  const totalCards = totalQuantity(deckCards);
  const requiredCounts = requiredZoneProgress(deckCards, data.deck.format);

  if (!hydrated) {
    return null;
  }

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
            onToggleSidebar={toggleSidebar}
            openDialog={dialogs.openDialog}
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
      <DeckDndContext deckId={deckId}>
        <div ref={containerRef} className={cn(PAGE_WIDTH.full, "px-safe relative flex gap-4")}>
          {isMobile ? (
            <DeckZoneDrawer deckId={deckId} onOverviewClick={handleOverviewClick}>
              {zonePanel(true)}
            </DeckZoneDrawer>
          ) : (
            <NestedSidebar
              className="w-(--sidebar-width)!"
              extraOffset="calc(0.75rem + 2rem + 0.75rem)"
              style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
            >
              <SidebarContent>
                <div className="p-4">{zonePanel(false)}</div>
              </SidebarContent>
            </NestedSidebar>
          )}

          <HoveredCardPreview
            hoveredCard={hoveredCard}
            origin={hoverOrigin}
            containerRef={containerRef}
          />

          <div className="flex min-w-0 flex-1 flex-col pb-3">
            {totalCards === 0 && (
              <div className="text-muted-foreground flex items-center gap-2 pt-1 pb-2 pl-8 md:hidden">
                <CornerLeftUpIcon className="size-4 shrink-0" />
                <span>
                  <ParaglideMessage
                    message={m.decks_editor_tap_zones}
                    markup={{
                      strong: PROSE_MARKUP.strong,
                    }}
                  />
                </span>
              </div>
            )}
            <div
              className="@container flex flex-1 items-stretch gap-6"
              style={
                {
                  "--sticky-top": `${headerHeight + topBarHeight}px`,
                } as React.CSSProperties
              }
            >
              {/* pb-20 clears the mobile deck dock so the last grid row stays
                  reachable while a zone is open. */}
              <div
                className={cn("flex min-w-0 flex-1 flex-col", isMobile && activeZone && "pb-20")}
              >
                <WorkbenchOptInBanner />
                <DeckCardBrowser
                  deckId={deckId}
                  ownershipData={ownershipData}
                  marketplace={marketplace}
                  onZoneClick={handleZoneClick}
                  onViewMissing={() => dialogs.openDialog("missing")}
                  onHoverCard={handleHoverMain}
                  onOverviewCardClick={openOverviewCard}
                  onEditDescription={isLocal ? undefined : () => dialogs.openDialog("details")}
                  // Variant families are server-only, so a local deck gets no
                  // rail at all.
                  variantRailSlot={isLocal ? undefined : <DeckVariantRail deckId={deckId} />}
                />
              </div>
              {!isMobile && activeZone === null && (
                <SelectionDetailPane
                  items={deckItems}
                  printingsByCardId={printingsByCardId}
                  showImages={showImages}
                  onSearchAndClose={() => {
                    // Swallowed: no catalog grid on the overview for these
                    // clicks to drive.
                  }}
                />
              )}
            </div>
            <Footer />
          </div>
        </div>
        {/* Overview only: with a zone open, DeckCardBrowser mounts its own
            overlay, and a second one here would duplicate it. */}
        {activeZone === null && (
          <SelectionDetailOverlays
            items={deckItems}
            printingsByCardId={printingsByCardId}
            showImages={showImages}
            onSearchAndClose={() => {
              // See comment on the desktop pane above.
            }}
          />
        )}
        {isMobile && activeZone && <DeckMobileDock deckId={deckId} zone={activeZone} />}
      </DeckDndContext>
    </div>
  );
}
