import { CARD_ASPECT } from "@openrift/shared/card-orientation";
import type { GroupByField } from "@openrift/shared/types/search";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { ReactNode } from "react";
import { Fragment, memo, useEffect, useEffectEvent, useRef, useState } from "react";

import { OrnamentRule } from "@/components/ui/ornament";
import { Pressable } from "@/components/ui/pressable";
import { useAdminSettings } from "@/features/admin/hooks/use-admin-settings";
import { useFilterSearchKey } from "@/features/cards/hooks/use-filter-search";
import { useFollowSelectedRow } from "@/features/cards/hooks/use-follow-selected-row";
import { useFollowSelection } from "@/features/cards/hooks/use-follow-selection";
import { useResponsiveColumns } from "@/features/cards/hooks/use-responsive-columns";
import { useStickyHeader } from "@/features/cards/hooks/use-sticky-header";
import {
  BUTTON_PAD,
  BUTTON_PAD_CLASS,
  FALLBACK_ROW_HEIGHT,
  HEADER_CONTENT_HEIGHT,
  HEADER_PB,
  HEADER_PT,
  LABEL_HEIGHT,
  STICKY_GROUP_LABEL_BAND,
} from "@/features/cards/lib/card-grid-constants";
import { computeGridMetrics } from "@/features/cards/lib/card-grid-metrics";
import type { VRow } from "@/features/cards/lib/card-grid-types";
import { buildGroups } from "@/features/cards/lib/card-groups";
import type { CardGroup } from "@/features/cards/lib/card-groups";
import { cardRowIndex } from "@/features/cards/lib/card-row-index";
import { computeRowStarts } from "@/features/cards/lib/compute-row-starts";
import { scrollCardRowIntoView } from "@/features/cards/lib/scroll-card-row";
import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import { useGridViewportStore } from "@/features/cards/stores/grid-viewport-store";
import { useEnumOrders } from "@/hooks/use-enums";
import { useHeaderHeight } from "@/hooks/use-header-height";
import { useScopeEffect, useScopeLayoutEffect } from "@/hooks/use-scope-effect";
import { useWindowScrollMargin } from "@/hooks/use-window-scroll-margin";
import type { GroupInfo } from "@/lib/card-group-types";
import type { CardRenderContext, CardViewerItem } from "@/lib/card-viewer-types";
import { STICKY_SURFACE } from "@/lib/sticky-surface";
import { cn } from "@/lib/utils";
import { useWindowVirtualizerFresh } from "@/lib/virtualizer-fresh";
import { useDisplayStore } from "@/stores/display-store";

import { CardGridDebug } from "./card-grid-debug";
import { CardViewerEmptyState } from "./card-viewer-empty-state";
import { ScrollIndicator } from "./scroll-indicator";

function buildVirtualRows(groups: CardGroup[], columns: number): VRow[] {
  const showHeaders = groups.length > 1;
  const rows: VRow[] = [];
  let cardsBefore = 0;
  for (const group of groups) {
    if (showHeaders) {
      rows.push({ kind: "header", group: group.group, cardCount: group.items.length });
    }
    for (let i = 0; i < group.items.length; i += columns) {
      const items = group.items.slice(i, i + columns);
      rows.push({ kind: "cards", items, cardsBefore });
      cardsBefore += items.length;
    }
  }
  return rows;
}

// Explicit memo + primitive `groupId` prop avoids minting a fresh onClick
// arrow every scroll tick, which would force this to re-render.
// oxlint-disable-next-line eslint/prefer-arrow-callback -- named for React DevTools
const GroupHeaderLabel = memo(function GroupHeaderLabel({
  slug,
  name,
  groupId,
  onSelect,
  className,
}: {
  slug: string;
  name: string;
  groupId: string;
  onSelect: (groupId: string) => void;
  className?: string;
}) {
  return (
    <Pressable
      className={cn("flex flex-row gap-3 text-sm", className)}
      onClick={() => onSelect(groupId)}
    >
      {slug && <span className="text-muted-foreground font-medium">{slug}</span>}
      <span className="font-semibold">{name}</span>
    </Pressable>
  );
});

function scrollToRow(virtualizer: Virtualizer<Window, Element>, rowIndex: number): void {
  if (rowIndex !== -1) {
    virtualizer.scrollToIndex(rowIndex, { align: "start", behavior: "auto" });
  }
}

// Explicit memo: rendered inside the virtualizer's items.map() which re-runs every
// scroll frame. React Compiler cannot memoize JSX created in dynamic .map() callbacks.
// ⚠ pt-4 / pb-2 are mirrored as HEADER_PT / HEADER_PB above — update both together
// oxlint-disable-next-line eslint/prefer-arrow-callback -- named for React DevTools
const HeaderRow = memo(function HeaderRow({
  row,
  rowIndex,
  virtualizer,
}: {
  row: VRow & { kind: "header" };
  rowIndex: number;
  virtualizer: Virtualizer<Window, Element>;
}) {
  return (
    <OrnamentRule fade="tips" className="pt-4 pb-2">
      <GroupHeaderLabel
        slug={row.group.slug}
        name={row.group.name}
        groupId={row.group.id}
        onSelect={() => scrollToRow(virtualizer, rowIndex)}
      />
    </OrnamentRule>
  );
});

// Explicit memo: rendered inside the virtualizer's items.map() which re-runs every
// scroll frame. React Compiler cannot memoize JSX created in dynamic .map() callbacks.
// oxlint-disable-next-line eslint/prefer-arrow-callback -- named for React DevTools
const CardRowContent = memo(function CardRowContent({
  row,
  columns,
  gap,
  labelHeight,
  addStripHeight,
  cardWidth,
  eagerCount,
  renderCard,
}: {
  row: VRow & { kind: "cards" };
  columns: number;
  gap: number;
  labelHeight: number;
  addStripHeight: number;
  cardWidth: number;
  eagerCount: number;
  renderCard: (item: CardViewerItem, ctx: CardRenderContext) => ReactNode;
}) {
  // Eager rows are SSR-preloaded by <FirstRowGrid>; skipping the deferred
  // placeholder phase for them avoids a flash before the cached image paints.
  const isEager = row.cardsBefore < eagerCount;
  const [deferred, setDeferred] = useState(!isEager);
  useEffect(() => {
    if (!deferred) {
      return;
    }
    // Safari has no requestIdleCallback; rAF + setTimeout approximates it.
    if (typeof globalThis.requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setDeferred(false), { timeout: 300 });
      return () => cancelIdleCallback(id);
    }
    let timerId: ReturnType<typeof setTimeout>;
    const rafId = requestAnimationFrame(() => {
      timerId = setTimeout(() => setDeferred(false), 0);
    });
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [deferred]);

  const gridStyle = {
    display: "grid" as const,
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: `${gap}px`,
  };

  if (deferred) {
    return (
      <div style={gridStyle}>
        {row.items.map((item) => (
          <div key={item.id} className={cn("rounded-lg", BUTTON_PAD_CLASS)}>
            {addStripHeight > 0 && <div style={{ height: addStripHeight }} />}
            <div className="bg-muted aspect-card rounded-lg" />
            {labelHeight > 0 && <div style={{ height: labelHeight }} />}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={gridStyle}>
      {row.items.map((item, colIndex) => {
        const flatIndex = row.cardsBefore + colIndex;
        // Kept false here; each cell subscribes to useGridFocusStore by its
        // own itemId, keeping ctx stable so the per-cell memo can skip re-renders.
        return (
          <Fragment key={item.id}>
            {renderCard(item, {
              isSelected: false,
              isFlashing: false,
              cardWidth,
              priority: flatIndex < eagerCount,
            })}
          </Fragment>
        );
      })}
    </div>
  );
});

interface CardGridProps {
  items: CardViewerItem[];
  totalItems: number;
  renderCard: (item: CardViewerItem, ctx: CardRenderContext) => ReactNode;
  setOrder?: GroupInfo[];
  collectionOrder?: GroupInfo[];
  groupBy?: GroupByField;
  groupDir?: "asc" | "desc";
  selectedItemId?: string;
  returnToItemId?: string;
  /** Called once the grid has tried the return scroll, with whether the item is in the grid. */
  onReturned?: (found: boolean) => void;
  addStripHeight?: number;
  stickyOffset?: number;
  noResultsDescription?: ReactNode;
}

export function CardGrid({
  items,
  totalItems,
  renderCard,
  setOrder,
  collectionOrder,
  groupBy = "set",
  groupDir = "asc",
  selectedItemId,
  returnToItemId,
  onReturned,
  addStripHeight = 0,
  stickyOffset: stickyOffsetProp,
  noResultsDescription,
}: CardGridProps) {
  const { orders, labels } = useEnumOrders();
  // Resolved in the body, not as a default param: the live header
  // measurement settles after hydration and would mismatch SSR markup.
  const headerHeight = useHeaderHeight();
  const stickyOffset = stickyOffsetProp ?? headerHeight;

  const maxColumns = useDisplayStore((s) => s.maxColumns);
  const setAutoColumns = useGridViewportStore((s) => s.setAutoColumns);

  const adminSettings = useAdminSettings();
  const debugOverlayEnabled = adminSettings?.debugOverlay === true;

  const { containerRef, containerEl, columns, containerWidth } = useResponsiveColumns(
    maxColumns,
    setAutoColumns,
  );

  const { gap, cardWidth: thumbWidth } = computeGridMetrics(containerWidth, columns);

  const groups = buildGroups(items, groupBy, setOrder, groupDir, orders, labels, collectionOrder);
  const multipleGroups = groups.length > 1;

  const labelHeight = LABEL_HEIGHT;

  const virtualRows = buildVirtualRows(groups, columns);

  const estimateRowHeight = (index: number): number => {
    const row = virtualRows[index];
    if (!row) {
      return FALLBACK_ROW_HEIGHT;
    }
    if (row.kind === "header") {
      return HEADER_PT + HEADER_CONTENT_HEIGHT + HEADER_PB;
    }
    const imgHeight = (thumbWidth - BUTTON_PAD * 2) / CARD_ASPECT;
    return Math.round(imgHeight + labelHeight + BUTTON_PAD * 2 + addStripHeight);
  };

  const rowStarts = computeRowStarts(virtualRows, estimateRowHeight, gap);

  const scrollMargin = useWindowScrollMargin(containerEl);

  const { virtualizer, virtualItems, totalSize } = useWindowVirtualizerFresh({
    count: virtualRows.length,
    estimateSize: estimateRowHeight,
    gap,
    scrollMargin,
    scrollPaddingStart: stickyOffset,
    overscan: 3,
  });

  const activeHeaderRow = useStickyHeader({
    multipleGroups,
    virtualRows,
    rowStarts,
    virtualizer,
    scrollMargin,
    stickyOffset,
    headerHeight: HEADER_PT + HEADER_CONTENT_HEIGHT + HEADER_PB,
    labelBand: STICKY_GROUP_LABEL_BAND,
  });

  /** False when the card is not in the grid. */
  const scrollToCard = (cardId: string): boolean => {
    const i = cardRowIndex(virtualRows, cardId);
    if (i === -1) {
      return false;
    }
    const vItem = virtualizer.getVirtualItems().find((vi) => vi.index === i);
    if (vItem) {
      const labelBand = multipleGroups ? STICKY_GROUP_LABEL_BAND : 0;
      const viewportTop = globalThis.scrollY + stickyOffset + labelBand;
      const viewportBottom = globalThis.scrollY + globalThis.innerHeight;
      if (vItem.start >= viewportTop && vItem.start + vItem.size <= viewportBottom) {
        return true;
      }
    }
    scrollCardRowIntoView(virtualizer, virtualRows, i, multipleGroups);
    return true;
  };

  const followSelection = useFollowSelection();
  const filterSearchKey = useFilterSearchKey();
  useScopeEffect(selectedItemId, (itemId) => {
    const follow = followSelection(itemId);
    if (!itemId) {
      useGridFocusStore.getState().setFlashCardId(null);
      return;
    }
    if (follow) {
      scrollToCard(itemId);
    }
    useGridFocusStore.getState().setFlashCardId(itemId);
    return () => {
      if (useGridFocusStore.getState().flashCardId === itemId) {
        useGridFocusStore.getState().setFlashCardId(null);
      }
    };
  });

  useFollowSelectedRow(
    selectedItemId,
    selectedItemId ? cardRowIndex(virtualRows, selectedItemId) : -1,
    columns,
    filterSearchKey,
    scrollToCard,
  );

  const topVisibleCardRef = useRef<string | null>(null);

  const trackTopVisibleCard = useEffectEvent(() => {
    const viewportTop = globalThis.scrollY + stickyOffset;
    for (const vItem of virtualizer.getVirtualItems()) {
      const row = virtualRows[vItem.index];
      if (row?.kind === "cards" && vItem.start + vItem.size > viewportTop) {
        topVisibleCardRef.current = row.items[0]?.id ?? null;
        return;
      }
    }
  });

  useEffect(() => {
    const onScroll = () => trackTopVisibleCard();
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    return () => globalThis.removeEventListener("scroll", onScroll);
  }, []);

  // react-virtual's estimateSize memo misses input changes that keep the row
  // count identical, leaving stale/mis-stacked row heights until measure() runs.
  const rowKindSignature = virtualRows.map((row) => (row.kind === "header" ? "h" : "c")).join("");
  useScopeLayoutEffect(`${rowKindSignature} ${columns} ${containerWidth} ${addStripHeight}`, () =>
    virtualizer.measure(),
  );

  // A grid under `display: none` measures 0 wide; its rows say nothing about the page until shown.
  useScopeEffect(containerWidth > 0 ? returnToItemId : undefined, (itemId) => {
    if (itemId) {
      const found = scrollToCard(itemId);
      onReturned?.(found);
    }
  });

  useScopeEffect(columns, () => {
    if (containerWidth === 0) {
      return;
    }
    const anchor = returnToItemId ?? selectedItemId ?? topVisibleCardRef.current;
    if (anchor) {
      scrollToCard(anchor);
    }
  });

  const eagerCount = columns;

  if (items.length === 0) {
    return (
      <div ref={containerRef} className="flex flex-1 flex-col">
        <CardViewerEmptyState totalItems={totalItems} noResultsDescription={noResultsDescription} />
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <CardGridDebug
        enabled={debugOverlayEnabled}
        virtualizer={virtualizer}
        virtualRows={virtualRows}
        containerWidth={containerWidth}
        columns={columns}
        labelHeight={labelHeight}
        estimateRowHeight={estimateRowHeight}
      />

      <ScrollIndicator
        virtualRows={virtualRows}
        rowStarts={rowStarts}
        virtualizer={virtualizer}
        scrollMargin={scrollMargin}
        multipleGroups={multipleGroups}
        stickyOffset={stickyOffset}
      />

      <div className="sticky z-20 h-0" style={{ top: stickyOffset }}>
        {multipleGroups && activeHeaderRow && (
          <div
            className="pointer-events-none flex items-end justify-center"
            style={{ height: STICKY_GROUP_LABEL_BAND }}
          >
            <OrnamentRule fade="tips" className="w-72 max-w-full">
              <GroupHeaderLabel
                slug={activeHeaderRow.group.slug}
                name={activeHeaderRow.group.name}
                groupId={activeHeaderRow.group.id}
                onSelect={(groupId) =>
                  scrollToRow(
                    virtualizer,
                    virtualRows.findIndex(
                      (row) => row.kind === "header" && row.group.id === groupId,
                    ),
                  )
                }
                className={cn(
                  STICKY_SURFACE,
                  "ring-border/70 pointer-events-auto rounded-lg px-3 py-1 shadow-sm ring-1",
                )}
              />
            </OrnamentRule>
          </div>
        )}
      </div>
      <div style={{ height: `${totalSize}px`, position: "relative" }}>
        {virtualItems.map((vItem) => {
          const row = virtualRows[vItem.index];
          if (!row) {
            return null;
          }

          return (
            <div
              key={vItem.key}
              data-index={vItem.index}
              className="has-[:hover]:z-10"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vItem.start - scrollMargin}px)`,
              }}
            >
              {row.kind === "header" ? (
                <HeaderRow row={row} rowIndex={vItem.index} virtualizer={virtualizer} />
              ) : (
                <CardRowContent
                  row={row}
                  columns={columns}
                  gap={gap}
                  labelHeight={labelHeight}
                  addStripHeight={addStripHeight}
                  cardWidth={thumbWidth}
                  eagerCount={eagerCount}
                  renderCard={renderCard}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
