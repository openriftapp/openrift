import { useLayoutEffect, useState } from "react";

let lastTop = 0;

/** Document-space top of `el` plus `extra`, for a window virtualizer's `scrollMargin`. */
export function useWindowScrollMargin(el: HTMLElement | null, extra = 0): number {
  const [top, setTop] = useState(lastTop);
  useLayoutEffect(() => {
    if (!el) {
      return;
    }
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().top + globalThis.scrollY);
      lastTop = next;
      setTop(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [el]);
  return top + extra;
}
