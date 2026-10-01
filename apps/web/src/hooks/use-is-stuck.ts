import { useEffect, useState } from "react";

export function useIsStuck(el: HTMLElement | null): boolean {
  const [isStuck, setIsStuck] = useState(false);
  useEffect(() => {
    if (!el) {
      return;
    }
    let rafId = 0;
    const check = () => {
      rafId = 0;
      // oxlint-disable-next-line unicorn/prefer-number-coercion -- Number("100px") is NaN
      const pinnedTop = Number.parseFloat(getComputedStyle(el).top);
      setIsStuck(el.getBoundingClientRect().top <= pinnedTop + 0.5);
    };
    const schedule = () => {
      if (rafId === 0) {
        rafId = requestAnimationFrame(check);
      }
    };
    check();
    globalThis.addEventListener("scroll", schedule, { passive: true });
    globalThis.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(rafId);
      globalThis.removeEventListener("scroll", schedule);
      globalThis.removeEventListener("resize", schedule);
    };
  }, [el]);
  return isStuck;
}
