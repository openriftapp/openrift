import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Pane({
  children,
  className,
  "data-testid": testId,
}: {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <aside
      className={cn(
        "sticky top-(--sticky-top) hidden max-h-[calc(100vh-var(--sticky-top))] w-[400px] shrink-0 pt-3",
        className,
      )}
      data-testid={testId}
    >
      {/* The top gap stays outside the scroller, so sticky headers rest where they stick. */}
      <div className="max-h-[calc(100vh-var(--sticky-top)-0.75rem)] overflow-y-auto">
        {children}
      </div>
    </aside>
  );
}
