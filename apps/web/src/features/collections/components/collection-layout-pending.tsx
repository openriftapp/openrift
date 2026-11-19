import { useMatches } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
  PAGE_TOP_BAR_STICKY_BASE,
  PageTopBar,
  PageTopBarSkeleton,
} from "@/components/layout/page-top-bar";
import { TopBarSlotPortal } from "@/components/layout/top-bar-slot";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const SKELETON_WIDTHS = ["w-28", "w-20", "w-24", "w-16", "w-32", "w-12"];

export function CollectionContent({
  setTopBarSlot,
  topBar,
  children,
  footer,
}: {
  setTopBarSlot?: (el: HTMLDivElement | null) => void;
  topBar?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="pr-safe pl-gutter flex min-w-0 flex-1 flex-col pb-3">
      {/* No px-safe here: the column already clears iOS safe areas, and px-safe
          would double-inset the bar on notched phones in landscape. */}
      <div
        ref={setTopBarSlot}
        className={cn(PAGE_TOP_BAR_STICKY_BASE, "mr-safe-neg pr-safe ml-gutter-neg pl-gutter")}
      >
        {topBar}
      </div>
      <div className="flex flex-1 flex-col pb-3">{children}</div>
      {footer}
    </div>
  );
}

/**
 * The expanded sidebar's markup, in plain elements: the route file imports this module, and
 * `components/ui/sidebar` would pull the base-ui chunk into the boot bundle. Keep the classes
 * and `data-slot` names in step with `Sidebar` / `NestedSidebar` there.
 */
function CollectionSidebarSkeleton() {
  return (
    <div
      className="group peer text-sidebar-foreground ml-safe hidden md:block"
      data-state="expanded"
      data-collapsible=""
      data-variant="sidebar"
      data-side="left"
      data-slot="sidebar"
    >
      <div data-slot="sidebar-gap" className="relative w-(--sidebar-width) bg-transparent" />
      <div
        data-slot="sidebar-container"
        data-side="left"
        style={{
          top: "var(--header-height)",
          height: "calc(100svh - var(--header-height) - 0px)",
        }}
        className="sticky! z-10 hidden h-svh w-(--sidebar-width) overflow-hidden! rounded-t-lg! border-0! data-[side=left]:left-0 md:flex"
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="bg-sidebar flex size-full flex-col"
        >
          <div className="flex flex-col gap-5 p-4">
            {SKELETON_WIDTHS.map((width) => (
              <Skeleton key={width} className={cn("h-4", width)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const GRID_ROUTE_IDS: ReadonlySet<string> = new Set([
  "/_app/_authenticated/collections/",
  "/_app/_authenticated/collections/$collectionId",
]);

/** Mirrors `CollectionTopBar`: below `lg` the count and value sit on a second line under the title. */
function CollectionGridTopBarSkeleton() {
  return (
    <PageTopBar className="h-auto lg:h-8">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-(--control-h) items-center">
          <Skeleton role="status" aria-label={m.common_loading()} className="h-6 w-48 max-w-full" />
        </div>
        <div className="flex h-4 items-center lg:hidden">
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </PageTopBar>
  );
}

/** Pending state of the whole collections layout; the server renders it for these client-only pages. */
export function CollectionLayoutPending() {
  const grid = useMatches({
    select: (matches) => GRID_ROUTE_IDS.has(matches.at(-1)?.routeId ?? ""),
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        data-slot="sidebar-wrapper"
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
        className="group/sidebar-wrapper flex min-h-0 w-full flex-1"
      >
        <CollectionSidebarSkeleton />
        <CollectionContent
          topBar={grid ? <CollectionGridTopBarSkeleton /> : <PageTopBarSkeleton />}
        />
      </div>
    </div>
  );
}

/** Pending state of a page inside the collections layout: a placeholder bar in the layout's top-bar slot. */
export function CollectionPagePending() {
  return (
    <TopBarSlotPortal>
      <PageTopBarSkeleton />
    </TopBarSlotPortal>
  );
}

/** {@link CollectionPagePending} for the collection grid pages, whose bar has a second line below `lg`. */
export function CollectionGridPagePending() {
  return (
    <TopBarSlotPortal>
      <CollectionGridTopBarSkeleton />
    </TopBarSlotPortal>
  );
}
