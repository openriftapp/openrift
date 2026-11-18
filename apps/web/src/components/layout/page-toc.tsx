import { clamp } from "@openrift/shared/math";
import { ListIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHeaderHeight } from "@/hooks/use-header-height";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { usePageTocStore } from "@/stores/page-toc-store";

export interface PageTocItem {
  id: string;
  label: string;
  level?: number;
}

/**
 * Takes over a jump to an item that is hidden or not rendered, e.g. folded or filtered out.
 * A returned promise settles once the page has rendered the item and scrolled to it.
 */
export type PageTocJump = (id: string) => Promise<void> | void;

function cssPixels(value: string): number {
  // oxlint-disable-next-line unicorn/prefer-number-coercion -- CSS px string; Number() would yield NaN
  return Number.parseFloat(value) || 0;
}

/** A smooth scroll that does not move fires no scrollend, so a hold would never release. */
function scrollWillMove(element: HTMLElement): boolean {
  const scroller = document.scrollingElement;
  if (!scroller) {
    return true;
  }
  const offset =
    element.getBoundingClientRect().top -
    cssPixels(getComputedStyle(element).scrollMarginTop) -
    cssPixels(getComputedStyle(scroller).scrollPaddingTop);
  const target = clamp(
    scroller.scrollTop + offset,
    0,
    Math.max(0, scroller.scrollHeight - scroller.clientHeight),
  );
  return Math.abs(target - scroller.scrollTop) >= 1;
}

/** A jump that rendered the item in place moved nothing, so no scrollend comes to end the hold. */
async function releaseUnlessJumpScrolls(
  jumped: Promise<void>,
  id: string,
  startTop: number | undefined,
  release: () => void,
): Promise<void> {
  await jumped;
  const element = document.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  if (element && document.scrollingElement?.scrollTop === startTop && !scrollWillMove(element)) {
    release();
  }
}

function TocLink({
  id,
  label,
  level,
  itemIds,
  onJump,
  onSelect,
}: {
  id: string;
  label: string;
  level: number;
  itemIds: readonly string[];
  onJump?: PageTocJump;
  onSelect?: () => void;
}) {
  const isActive = usePageTocStore((state) =>
    state.activeId !== null && itemIds.includes(state.activeId)
      ? state.activeId === id
      : itemIds[0] === id,
  );
  const selectActiveId = usePageTocStore((state) => state.selectActiveId);
  const releaseHold = usePageTocStore((state) => state.releaseHold);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const element = document.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    // Safari 16.4 has no scrollend; there the observer may move the highlight mid-scroll.
    const canHold = "onscrollend" in globalThis;
    const holdEnd = new AbortController();
    const release = () => {
      holdEnd.abort();
      releaseHold(id);
    };
    const hold = (held: boolean) => {
      if (held) {
        // Capture: a nested scroller's scrollend does not bubble to the document.
        document.addEventListener("scrollend", release, {
          once: true,
          capture: true,
          signal: holdEnd.signal,
        });
      }
      selectActiveId(id, held);
    };
    if (element && (onJump === undefined || element.getClientRects().length > 0)) {
      event.preventDefault();
      hold(canHold && scrollWillMove(element));
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (onJump) {
      event.preventDefault();
      // Held before the jump renders: the page reveals the target and the router scrolls to it.
      const startTop = document.scrollingElement?.scrollTop;
      hold(canHold);
      const jumped = onJump(id);
      if (canHold && jumped) {
        void releaseUnlessJumpScrolls(jumped, id, startTop, release);
      }
    }
    onSelect?.();
  }

  const restTone = level > 0 ? "text-muted-foreground/70" : "text-muted-foreground";

  return (
    <a
      href={`#${id}`}
      onClick={handleClick}
      aria-current={isActive ? "location" : undefined}
      style={level > 0 ? { paddingLeft: `${level}rem` } : undefined}
      className={cn(
        "block truncate text-sm transition-colors",
        isActive ? "text-foreground font-medium" : `${restTone} hover:text-foreground`,
      )}
    >
      {label}
    </a>
  );
}

function activeSection(visible: HTMLElement[], bandTop: number): HTMLElement | undefined {
  const sections = visible.map((element) => ({
    element,
    top: element.getBoundingClientRect().top,
  }));
  const entered = sections.filter((section) => section.top >= bandTop - 1);
  const pick =
    entered.length > 0
      ? entered.toSorted((a, b) => a.top - b.top).at(0)
      : sections.toSorted((a, b) => b.top - a.top).at(0);
  return pick?.element;
}

function useActiveTocItem(items: PageTocItem[]) {
  const setActiveId = usePageTocStore((state) => state.setActiveId);
  const releaseHold = usePageTocStore((state) => state.releaseHold);
  const headerHeight = Math.round(useHeaderHeight());
  const idsKey = items.map((item) => item.id).join(" ");

  useEffect(() => () => releaseHold(), [releaseHold]);

  useEffect(() => {
    if (idsKey === "") {
      return;
    }
    const elements = idsKey
      .split(" ")
      .map((id) => document.querySelector<HTMLElement>(`#${CSS.escape(id)}`))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) {
      return;
    }

    const intersecting = new Map<Element, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.set(entry.target, entry.isIntersecting);
        }
        const active = activeSection(
          elements.filter((element) => intersecting.get(element) === true),
          headerHeight,
        );
        if (active) {
          setActiveId(active.id);
        }
      },
      { rootMargin: `-${headerHeight}px 0px -60% 0px`, threshold: 0 },
    );

    for (const element of elements) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [idsKey, setActiveId, headerHeight]);
}

export function PageToc({
  items,
  onJump,
  className,
}: {
  items: PageTocItem[];
  onJump?: PageTocJump;
  className?: string;
}) {
  useActiveTocItem(items);
  const itemIds = items.map((item) => item.id);

  return (
    <aside
      className={cn(
        "sticky top-(--sticky-top) hidden max-h-[calc(100vh-var(--sticky-top))] w-48 shrink-0 lg:block",
        className,
      )}
    >
      <ScrollArea className="h-full">
        <nav className="space-y-1.5">
          {items.map((item) => (
            <TocLink
              key={item.id}
              id={item.id}
              label={item.label}
              level={item.level ?? 0}
              itemIds={itemIds}
              onJump={onJump}
            />
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

/**
 * Pair with PageToc on the same page: this drawer shares its list but relies
 * on PageToc's observer to keep activeId in sync.
 */
export function PageTocMobileTrigger({
  items,
  onJump,
  className,
  labelClassName,
}: {
  items: PageTocItem[];
  onJump?: PageTocJump;
  className?: string;
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const itemIds = items.map((item) => item.id);

  if (items.length === 0) {
    return null;
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={m.layout_toc_open()}
            className={cn("lg:hidden", className)}
          />
        }
      >
        <ListIcon />
        {labelClassName === undefined ? null : (
          <span className={labelClassName}>{m.layout_toc_title()}</span>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{m.layout_toc_title()}</DrawerTitle>
          <DrawerDescription className="sr-only">{m.layout_toc_description()}</DrawerDescription>
        </DrawerHeader>
        {/* Native overflow scroll, not ScrollArea: the Drawer's touch handling
            doesn't recognize ScrollArea's custom overflow:scroll viewport. */}
        <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-6">
          {items.map((item) => (
            <TocLink
              key={item.id}
              id={item.id}
              label={item.label}
              level={item.level ?? 0}
              itemIds={itemIds}
              onJump={onJump}
              onSelect={() => setOpen(false)}
            />
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
