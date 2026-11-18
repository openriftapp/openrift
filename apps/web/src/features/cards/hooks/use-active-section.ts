import { useEffect, useEffectEvent, useState } from "react";

/** Must match CardGrid's sticky-pill "active" definition. */
export function useActiveSection(
  entries: { id: string; label: string }[],
  threshold: number,
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  const update = useEffectEvent(() => {
    const limit = threshold + 4;
    let active: string | null = null;
    for (const entry of entries) {
      // oxlint-disable-next-line unicorn/prefer-query-selector -- ids derive from channel ids that may start with a digit; getElementById skips CSS-escape gymnastics.
      const el = document.getElementById(entry.id);
      if (!el) {
        continue;
      }
      if (el.getBoundingClientRect().top <= limit) {
        active = entry.id;
      } else {
        break;
      }
    }
    setActiveId((prev) => (prev === active ? prev : active));
  });

  useEffect(() => {
    const onScroll = () => update();
    onScroll();
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    return () => globalThis.removeEventListener("scroll", onScroll);
  }, []);

  return activeId;
}
