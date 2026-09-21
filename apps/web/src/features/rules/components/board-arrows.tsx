import type { BoardArrow, BoardPiece } from "@openrift/shared/board-state";
import { useLayoutEffect, useState } from "react";

import { arrowZoneKey } from "@/features/rules/lib/board-layout";

interface ArrowLine {
  kind: BoardArrow["kind"];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
}

/** Arrows are measured from the DOM; the overlay remounts whenever a piece changes seat, zone or footprint. */
export function pieceLayoutSignature(pieces: readonly BoardPiece[]): string {
  return pieces
    .map((piece) =>
      [
        piece.id,
        piece.owner,
        piece.zone.kind,
        piece.zone.kind === "battlefield" ? piece.zone.index : "",
        piece.exhausted ? "x" : "",
      ].join(":"),
    )
    .join("|");
}

function centerOf(element: Element, origin: DOMRect) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left - origin.left + rect.width / 2,
    y: rect.top - origin.top + rect.height / 2,
  };
}

function measureArrows(container: HTMLElement, arrows: BoardArrow[]): ArrowLine[] {
  const origin = container.getBoundingClientRect();
  const lines: ArrowLine[] = [];
  for (const arrow of arrows) {
    const from = container.querySelector(`[data-board-piece="${arrow.from}"]`);
    const toSelector =
      "piece" in arrow.to
        ? `[data-board-piece="${arrow.to.piece}"]`
        : `[data-board-zone="${arrowZoneKey(arrow.to.zone, arrow.to.owner)}"]`;
    const to = container.querySelector(toSelector);
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
      </defs>
      {lines.map((line, index) => (
        <path
          // oxlint-disable-next-line react/no-array-index-key -- arrows are positional
          key={index}
          d={`M${line.x1} ${line.y1}Q${line.cx} ${line.cy} ${line.x2} ${line.y2}`}
          fill="none"
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={line.kind === "move" ? "7 5" : undefined}
          markerEnd="url(#board-arrow-head)"
        />
      ))}
    </svg>
  );
}
