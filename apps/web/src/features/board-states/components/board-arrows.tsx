import type {
  ArrowKind,
  BoardArrow,
  BoardArrowEnd,
  BoardDocument,
  BoardStep,
} from "@openrift/shared/board-state";
import { ARROW_KINDS } from "@openrift/shared/board-state";
import { useLayoutEffect, useState } from "react";

import { ARROW_KIND_LABEL } from "@/features/board-states/lib/board-labels";
import { arrowZoneKey } from "@/features/board-states/lib/board-layout";

interface ArrowLine {
  kind: ArrowKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
}

const ARROW_DASH: Record<ArrowKind, string | undefined> = {
  move: "7 5",
  target: undefined,
  recall: "1 5",
};

const ARROW_HEAD: Record<ArrowKind, string> = {
  move: "board-arrow-head",
  target: "board-arrow-head",
  recall: "board-arrow-head-open",
};

/**
 * Arrows are measured from the DOM; the overlay remounts whenever anything that moves a
 * piece, a chain entry or a zone changes: seats, zones, footprints, the turn bar and stats.
 */
export function arrowLayoutSignature(document: BoardDocument, step: BoardStep): string {
  return JSON.stringify([
    document.playerCount,
    document.battlefields.length,
    document.zones,
    step.pieces.map((piece) => [
      piece.id,
      piece.owner,
      piece.zone,
      piece.exhausted,
      piece.keywords.length,
    ]),
    step.chain.map((entry) => entry.id),
    step.turn,
    step.players,
    step.battlefields,
  ]);
}

function centerOf(element: Element, origin: DOMRect) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left - origin.left + rect.width / 2,
    y: rect.top - origin.top + rect.height / 2,
  };
}

function endSelector(end: BoardArrowEnd): string {
  if ("piece" in end) {
    return `[data-board-piece="${end.piece}"]`;
  }
  if ("chain" in end) {
    return `[data-board-chain="${end.chain}"]`;
  }
  return `[data-board-zone="${arrowZoneKey(end.zone, end.owner)}"]`;
}

function measureArrows(container: HTMLElement, arrows: BoardArrow[]): ArrowLine[] {
  const origin = container.getBoundingClientRect();
  const lines: ArrowLine[] = [];
  for (const arrow of arrows) {
    const from = container.querySelector(endSelector(arrow.from));
    const to = container.querySelector(endSelector(arrow.to));
    if (!from || !to) {
      continue;
    }
    const start = centerOf(from, origin);
    const end = centerOf(to, origin);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const bow = 0.16;
    lines.push({
      kind: arrow.kind,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      cx: (start.x + end.x) / 2 - dy * bow,
      cy: (start.y + end.y) / 2 + dx * bow,
    });
  }
  return lines;
}

function ArrowMarkers() {
  return (
    <defs>
      <marker
        id="board-arrow-head"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M0 0L10 5L0 10z" fill="white" />
      </marker>
      <marker
        id="board-arrow-head-open"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path
          d="M1 1L8 5L1 9"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
    </defs>
  );
}

function ArrowStroke({ kind, d }: { kind: ArrowKind; d: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="white"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeDasharray={ARROW_DASH[kind]}
      markerEnd={`url(#${ARROW_HEAD[kind]})`}
    />
  );
}

export function ArrowOverlay({
  containerRef,
  arrows,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  arrows: BoardArrow[];
}) {
  const [lines, setLines] = useState<ArrowLine[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const update = () => setLines(measureArrows(container, arrows));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, arrows]);

  if (lines.length === 0) {
    return null;
  }
  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
      <ArrowMarkers />
      {lines.map((line, index) => (
        <ArrowStroke
          // oxlint-disable-next-line react/no-array-index-key -- arrows are positional
          key={index}
          kind={line.kind}
          d={`M${line.x1} ${line.y1}Q${line.cx} ${line.cy} ${line.x2} ${line.y2}`}
        />
      ))}
    </svg>
  );
}

/** Explains the arrow styles the step actually uses. */
export function ArrowLegend({ arrows }: { arrows: readonly BoardArrow[] }) {
  const kinds = ARROW_KINDS.filter((kind) => arrows.some((arrow) => arrow.kind === kind));
  if (kinds.length === 0) {
    return null;
  }
  return (
    <div className="text-2xs mt-2 flex flex-wrap gap-3 text-white/70 uppercase">
      {kinds.map((kind) => (
        <span key={kind} className="flex items-center gap-1.5">
          <svg width="28" height="10" aria-hidden className="overflow-visible">
            <ArrowMarkers />
            <ArrowStroke kind={kind} d="M2 5L24 5" />
          </svg>
          {ARROW_KIND_LABEL[kind]()}
        </span>
      ))}
    </div>
  );
}
