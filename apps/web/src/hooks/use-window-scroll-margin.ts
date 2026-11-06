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
  return top + extra;
}
