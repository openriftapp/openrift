import { useEffect, useState } from "react";

export interface ScrollEdges {
  start: boolean;
  end: boolean;
}

export function horizontalScrollEdges(element: {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}): ScrollEdges {
  const maxScroll = element.scrollWidth - element.clientWidth;
  return { start: element.scrollLeft > 1, end: element.scrollLeft < maxScroll - 1 };
}

export function useScrollEdges(): {
  ref: (element: HTMLElement | null) => void;
  edges: ScrollEdges;
} {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [edges, setEdges] = useState<ScrollEdges>({ start: false, end: false });

  useEffect(() => {
    if (!scroller) {
      return;
    }
    const update = () => {
      const next = horizontalScrollEdges(scroller);
      setEdges((previous) =>
        previous.start === next.start && previous.end === next.end ? previous : next,
      );
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    if (scroller.firstElementChild) {
      observer.observe(scroller.firstElementChild);
    }
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [scroller]);

  return { ref: setScroller, edges };
}
