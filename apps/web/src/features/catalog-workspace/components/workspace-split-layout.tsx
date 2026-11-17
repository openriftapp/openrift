import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { usePageTopBarHeight } from "@/components/layout/page-top-bar";
import { isTypingTarget } from "@/lib/keyboard-target";
import { openOverlayPresent } from "@/lib/open-overlay";
import { cn } from "@/lib/utils";

const PANE_GAP_PX = 12;

export function WorkspaceSplitLayout({
  header,
  list,
  children,
  recordKey,
  recordFirst,
  collapsed,
}: {
  header: ReactNode;
  list: ReactNode;
  children: ReactNode;
  recordKey: string | null;
  recordFirst: boolean;
  collapsed: boolean;
}) {
  const topBarHeight = usePageTopBarHeight();
  const recordRef = useRef<HTMLElement>(null);
  const shownRecord = useRef(recordKey);
  useEffect(() => {
    if (shownRecord.current === recordKey) {
      return;
    }
    shownRecord.current = recordKey;
    if (recordKey === null || isTypingTarget(document.activeElement) || openOverlayPresent()) {
      return;
    }
    recordRef.current?.focus({ preventScroll: true });
  }, [recordKey]);
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
        ref={recordRef}
        tabIndex={-1}
        aria-label="Record"
        className={cn(
          "min-w-0 flex-1 outline-none md:sticky md:top-(--workspace-top) md:max-h-[calc(100dvh-var(--workspace-top))] md:overflow-y-auto",
          !recordFirst && "hidden md:block",
        )}
      >
        {children}
      </section>
    </div>
  );
}
