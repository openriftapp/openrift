import { useLayoutEffect, useState } from "react";

/** Rounded border-box width or height of `el`, measured before paint; 0 while `el` is null. */
export function useMeasuredDimension(el: HTMLElement | null, axis: "width" | "height"): number {
  const [size, setSize] = useState(0);
  const [measuredEl, setMeasuredEl] = useState(el);
  if (measuredEl !== el) {
    setMeasuredEl(el);
    if (!el) {
      setSize(0);
    }
  }
  useLayoutEffect(() => {
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const box = entry.borderBoxSize[0];
      const measured =
        axis === "width"
          ? (box?.inlineSize ?? entry.contentRect.width)
          : (box?.blockSize ?? entry.contentRect.height);
      setSize(Math.round(measured));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, axis]);
  return size;
}
