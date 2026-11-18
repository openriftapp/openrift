import { useEffect, useRef, useState } from "react";

const EDGE_SIZE = 40;
/** Pixels per frame at the very edge; scaled down across the edge band. */
const SCROLL_SPEED = 15;
const SIDEBAR_VIEWPORT_SELECTOR = '[data-slot="sidebar-content"]';

/** Speed ramps from 0 at the inner edge of the band to SCROLL_SPEED at the container's edge, clamped there. */
export function edgeScrollDelta(input: {
  pointerY: number;
  top: number;
  bottom: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): number {
  const { pointerY, top, bottom, scrollTop, scrollHeight, clientHeight } = input;
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) {
    return 0;
  }
  const distFromTop = pointerY - top;
  const distFromBottom = bottom - pointerY;
  if (distFromTop < EDGE_SIZE && scrollTop > 0) {
    return -SCROLL_SPEED * Math.min(1, 1 - distFromTop / EDGE_SIZE);
  }
  if (distFromBottom < EDGE_SIZE && scrollTop < maxScroll) {
    return SCROLL_SPEED * Math.min(1, 1 - distFromBottom / EDGE_SIZE);
  }
  return 0;
}

export function isPointInRect(
  x: number,
  y: number,
  rect: { top: number; right: number; bottom: number; left: number },
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function isPageScroller(element: Element): boolean {
  return (
    element === document.scrollingElement ||
    element === document.documentElement ||
    element === document.body
  );
}

/** dnd-kit scrolls the page before the sidebar; this vetoes the page over the sidebar and edge-scrolls it for drags from the main view. */
export function useDragAutoScroll() {
  const [dragging, setDragging] = useState(false);
  const activeNodeRef = useRef<HTMLElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!dragging) {
      return;
    }
    let rafId = 0;

    const handlePointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };

    const scrollLoop = () => {
      const { x, y } = pointerRef.current;
      for (const element of document.elementsFromPoint(x, y)) {
        if (!(element instanceof HTMLElement) || isPageScroller(element)) {
          continue;
        }
        if (activeNodeRef.current && element.contains(activeNodeRef.current)) {
          continue;
        }
        const { overflowY } = getComputedStyle(element);
        if (overflowY !== "auto" && overflowY !== "scroll") {
          continue;
        }
        const rect = element.getBoundingClientRect();
        const delta = edgeScrollDelta({
          pointerY: y,
          top: rect.top,
          bottom: rect.bottom,
          scrollTop: element.scrollTop,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        });
        if (delta !== 0) {
          element.scrollBy(0, delta);
          break;
        }
      }
      rafId = requestAnimationFrame(scrollLoop);
    };

    globalThis.addEventListener("pointermove", handlePointerMove);
    rafId = requestAnimationFrame(scrollLoop);
    return () => {
      globalThis.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(rafId);
    };
  }, [dragging]);

  const canScroll = (element: Element) => {
    if (!isPageScroller(element)) {
      return true;
    }
    const rect = document.querySelector(SIDEBAR_VIEWPORT_SELECTOR)?.getBoundingClientRect();
    const { x, y } = pointerRef.current;
    return rect === undefined || !isPointInRect(x, y, rect);
  };

  const start = (activatorEvent: Event) => {
    activeNodeRef.current =
      activatorEvent.target instanceof HTMLElement ? activatorEvent.target : null;
    if (activatorEvent instanceof MouseEvent) {
      pointerRef.current = { x: activatorEvent.clientX, y: activatorEvent.clientY };
    }
    setDragging(true);
  };

  const stop = () => {
    activeNodeRef.current = null;
    setDragging(false);
  };

  return { autoScroll: { canScroll }, start, stop };
}
