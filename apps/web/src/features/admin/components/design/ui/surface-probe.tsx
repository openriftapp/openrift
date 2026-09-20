import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type { Surface } from "@/features/admin/components/design/demo-primitives";
import { SurfaceReadout, readSurface } from "@/features/admin/components/design/demo-primitives";

export function SurfaceProbe({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<Surface | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const update = (event: Event) => {
      const target = event.target;
      if (target instanceof Element) {
        const found = target.closest<HTMLElement>("[data-slot]");
        if (found && found.dataset.slot !== "heading") {
          setSurface(readSurface(found));
        }
      }
    };
    root.addEventListener("pointerover", update);
    root.addEventListener("focusin", update);
    // Controls carry transition-colors, so the pointerover read lands on the
    // pre-hover color; the settled one only exists once the transition ends.
    root.addEventListener("transitionend", update);
    return () => {
      root.removeEventListener("pointerover", update);
      root.removeEventListener("focusin", update);
      root.removeEventListener("transitionend", update);
    };
  }, []);

  return (
    <div ref={rootRef} className="flex flex-col gap-8">
      <SurfaceReadout surface={surface} />
      {children}
    </div>
  );
}
