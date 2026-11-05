import type { Virtualizer } from "@tanstack/react-virtual";

import { useScrollIndicator } from "@/features/cards/hooks/use-scroll-indicator";
import type { VRow } from "@/features/cards/lib/card-grid-types";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { STICKY_SURFACE } from "@/lib/sticky-surface";
import { cn } from "@/lib/utils";

const INDICATOR_CHIP = cn(
  STICKY_SURFACE,
  "inline-flex items-center rounded-lg font-mono font-medium whitespace-nowrap ring-1 select-none",
);

interface ScrollIndicatorProps {
  virtualRows: VRow[];
  rowStarts: number[];
  virtualizer: Virtualizer<Window, Element>;
  scrollMargin: number;
  multipleGroups: boolean;
  stickyOffset: number;
}

export function ScrollIndicator({
  virtualRows,
  rowStarts,
  virtualizer,
  scrollMargin,
  multipleGroups,
  stickyOffset,
}: ScrollIndicatorProps) {
  const {
    indicator,
    indicatorRef,
    cardIdRef,
    badgeRef,
    isDraggingRef,
    handleIndicatorPointerDown,
    snapPointElsRef,
    handleMoveRef,
    handleUpRef,
    handleMouseEnter,
    handleMouseLeave,
    snapPoints,
  } = useScrollIndicator({
    virtualRows,
    rowStarts,
    virtualizer,
    scrollMargin,
    multipleGroups,
    stickyOffset,
  });
  const coarsePointer = useCoarsePointer();

  return (
    <>
      <div
        ref={indicatorRef}
        className={cn(
          "fixed z-30 transition-opacity duration-300",
          indicator.visible ? "pointer-events-auto" : "pointer-events-none",
          coarsePointer && "-m-2 p-2",
        )}
        style={{
          right: 20,
          top: 0,
          // Drag sets transform directly on indicatorRef to skip React re-renders;
          // this value only matters at drag-start/end, when it resyncs to the ref.
          transform: `translateY(calc(${indicator.indicatorTop}px - 50%))`,
          willChange: "transform",
          opacity: indicator.visible ? 1 : 0,
          touchAction: "none",
        }}
        onPointerDown={handleIndicatorPointerDown}
        onPointerMove={(e) => {
          if (isDraggingRef.current) {
            handleMoveRef.current(e.clientY);
          }
        }}
        onPointerUp={() => {
          if (isDraggingRef.current) {
            handleUpRef.current();
          }
        }}
        onPointerCancel={() => {
          if (isDraggingRef.current) {
            handleUpRef.current();
          }
        }}
        onLostPointerCapture={() => {
          if (isDraggingRef.current) {
            handleUpRef.current();
          }
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={cn(
            "flex origin-right items-center gap-1.5 transition-transform duration-200 ease-out",
            indicator.dragging ? "scale-110" : "scale-100",
          )}
        >
          <div
            ref={badgeRef}
            className={cn(
              INDICATOR_CHIP,
              "shadow-sm",
              coarsePointer ? "px-4 py-1.5 text-sm" : "px-3.5 py-1 text-sm",
              indicator.dragging ? "ring-primary cursor-grabbing" : "ring-border/70 cursor-grab",
            )}
          >
            <span ref={cardIdRef}>{indicator.cardId || "\u00A0"}</span>
          </div>
          <div className="bg-primary/70 size-2 shrink-0 rounded-full" />
        </div>
      </div>

      {indicator.dragging &&
        multipleGroups &&
        snapPoints.map((pt) => (
          <div
            key={pt.rowIndex}
            ref={(el) => {
              if (el) {
                snapPointElsRef.current.set(pt.rowIndex, el);
              } else {
                snapPointElsRef.current.delete(pt.rowIndex);
              }
            }}
            className={cn(
              "pointer-events-none fixed z-29 transition-opacity duration-300",
              coarsePointer && "-m-2 p-2",
            )}
            style={{
              right: 20,
              top: pt.screenY,
              transform: "translateY(-50%)",
              opacity: indicator.dragging ? 1 : 0,
            }}
          >
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  INDICATOR_CHIP,
                  "text-muted-foreground ring-border/50",
                  coarsePointer ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
                )}
              >
                {pt.group.name}
              </div>
              <div className="bg-muted-foreground/60 size-1.5 shrink-0 rounded-full" />
            </div>
          </div>
        ))}
    </>
  );
}
