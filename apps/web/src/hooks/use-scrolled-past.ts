import { useEffect, useState } from "react";

export function useScrolledPast(threshold: number): boolean {
  const [scrolledPast, setScrolledPast] = useState(false);
  useEffect(() => {
    let rafId = 0;
    const check = () => {
      rafId = 0;
      setScrolledPast(globalThis.scrollY > threshold);
    };
    const schedule = () => {
      if (rafId === 0) {
        rafId = requestAnimationFrame(check);
      }
    };
    check();
    globalThis.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      globalThis.removeEventListener("scroll", schedule);
    };
  }, [threshold]);
  return scrolledPast;
}
