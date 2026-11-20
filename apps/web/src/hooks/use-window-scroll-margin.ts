import { useLayoutEffect, useState } from "react";

/** Document-space top of `el` plus `extra`, for a window virtualizer's `scrollMargin`. */
export function useWindowScrollMargin(el: HTMLElement | null, extra = 0): number {
  return (useMeasuredWindowScrollMargin(el) ?? 0) + extra;
}

export function useMeasuredWindowScrollMargin(el: HTMLElement | null): number | undefined {
  const [top, setTop] = useState<number>();
  useLayoutEffect(() => {
    if (!el) {
      return;
    }
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().top + globalThis.scrollY);
      setTop(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    // An element mounted hidden measures 0 until it is shown.
    observer.observe(el);
    // A min-height page keeps the body's size when content above `el` grows,
    // so watch everything that sits above it as well.
    for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
      for (
        let sibling = node.previousElementSibling;
        sibling;
        sibling = sibling.previousElementSibling
      ) {
        observer.observe(sibling);
      }
      if (node.parentElement && node.parentElement !== document.body) {
        observer.observe(node.parentElement);
      }
    }
    return () => observer.disconnect();
  }, [el]);
  return el === null ? undefined : top;
}
