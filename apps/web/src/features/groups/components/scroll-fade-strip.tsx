import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useScrollEdges } from "@/hooks/use-scroll-edges";

export function ScrollFadeStrip({ children }: { children: ReactNode }) {
  const { ref, edges } = useScrollEdges();

  return (
    <div className="relative shadow-[inset_0_-1px_0_var(--color-border)]">
      <div ref={ref} className="no-scrollbar overflow-x-auto pb-px">
        {children}
      </div>
      {edges.start ? (
        <div
          aria-hidden="true"
          className="from-background pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center bg-linear-to-r to-transparent"
        >
          <ChevronLeftIcon className="text-muted-foreground size-4" />
        </div>
      ) : null}
      {edges.end ? (
        <div
          aria-hidden="true"
          className="from-background pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-linear-to-l to-transparent"
        >
          <ChevronRightIcon className="text-muted-foreground size-4" />
        </div>
      ) : null}
    </div>
  );
}
