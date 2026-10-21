import type { CSSProperties, ReactNode } from "react";

import { usePageTopBarHeight } from "@/components/layout/page-top-bar";
import { cn } from "@/lib/utils";

const PANE_GAP_PX = 12;

export function WorkspaceSplitLayout({
  header,
  list,
  children,
  recordFirst,
  collapsed,
}: {
  header: ReactNode;
  list: ReactNode;
  children: ReactNode;
  recordFirst: boolean;
  collapsed: boolean;
}) {
  const topBarHeight = usePageTopBarHeight();
  const style = {
    "--workspace-bar": `${topBarHeight}px`,
    "--workspace-top": `${topBarHeight + PANE_GAP_PX}px`,
  } as CSSProperties;

  return (
    <div className="flex min-w-0 items-start gap-4" style={style}>
      {!(collapsed && recordFirst) && (
        <aside
          aria-label="Queue"
          className={cn(
            "w-full min-w-0 md:w-[360px] md:shrink-0 md:border-r",
            recordFirst && "hidden md:block",
          )}
        >
          <div className="bg-background sticky top-(--workspace-bar) z-10 pt-1">{header}</div>
          {list}
        </aside>
      )}
      <section
        aria-label="Record"
        className={cn(
          "min-w-0 flex-1 md:sticky md:top-(--workspace-top) md:max-h-[calc(100dvh-var(--workspace-top))] md:overflow-y-auto",
          !recordFirst && "hidden md:block",
        )}
      >
        {children}
      </section>
    </div>
  );
}
