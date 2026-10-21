import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import type { ListEntry, WorkspaceTarget } from "@/features/catalog-workspace/lib/owner-items";
import { compactAge } from "@/features/catalog-workspace/lib/owner-items";
import type { WorkspaceSearch } from "@/features/catalog-workspace/lib/workspace-search";
import { useScopeEffect, useScopeLayoutEffect } from "@/hooks/use-scope-effect";
import { cn } from "@/lib/utils";
import { useWindowVirtualizerFresh } from "@/lib/virtualizer-fresh";

const ROW_HEIGHT = 60;

export function WorkspaceTargetLink({
  target,
  className,
  current,
  search,
  children,
}: {
  target: WorkspaceTarget;
  className?: string;
  current?: boolean;
  search?: WorkspaceSearch;
  children: ReactNode;
}) {
  const shared = {
    className,
    "aria-current": current ? ("page" as const) : undefined,
    search: search ?? (true as const),
  };
  switch (target.kind) {
    case "card": {
      return (
        <Link
          to="/admin/workspace/cards/$cardSlug"
          params={{ cardSlug: target.cardSlug }}
          {...shared}
        >
          {children}
        </Link>
      );
    }
    case "card-new": {
      return (
        <Link to="/admin/workspace/cards/new/$name" params={{ name: target.name }} {...shared}>
          {children}
        </Link>
      );
    }
    case "face": {
      return (
        <Link
          to="/admin/workspace/faces/$cardSlug/$faceId"
          params={{ cardSlug: target.cardSlug, faceId: target.faceId }}
          {...shared}
        >
          {children}
        </Link>
      );
    }
    case "printing": {
      return (
        <Link
          to="/admin/workspace/printings/$printingId"
          params={{ printingId: target.printingId }}
          {...shared}
        >
          {children}
        </Link>
      );
    }
    case "printing-new": {
      return (
        <Link
          to="/admin/workspace/printings/new/$candidatePrintingId"
          params={{ candidatePrintingId: target.candidatePrintingId }}
          {...shared}
        >
          {children}
        </Link>
      );
    }
  }
}

function QueueRow({ entry, selected }: { entry: ListEntry; selected: boolean }) {
  const content = (
    <>
      {entry.imageUrl !== undefined && (
        <CardArtThumb
          src={deskImageSrc(entry.imageUrl, "240w")}
          alt=""
          loading="lazy"
          className="w-8 min-w-0 shrink-0"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">{entry.title}</span>
          {entry.code !== undefined && (
            <span className="text-muted-foreground shrink-0 font-mono text-xs">{entry.code}</span>
          )}
        </span>
        <span className="text-muted-foreground block truncate text-xs">{entry.detail}</span>
      </span>
      {entry.createdAt !== undefined && (
        <span className="text-muted-foreground shrink-0 text-xs">
          {compactAge(entry.createdAt)}
        </span>
      )}
      {entry.decisions !== undefined && <Badge variant="warning">{entry.decisions}</Badge>}
    </>
  );
  const className = cn(
    "flex h-full items-center gap-3 border-b border-l-2 border-l-transparent px-3",
    entry.draft === true && "border-l-violet",
    selected && "bg-primary/10 border-l-primary",
  );

  if (entry.target === null) {
    return <div className={cn(className, "opacity-60")}>{content}</div>;
  }
  return (
    <WorkspaceTargetLink
      target={entry.target}
      current={selected}
      className={cn(className, "hover:bg-muted/50 focus-visible:bg-muted/50 outline-none")}
    >
      {content}
    </WorkspaceTargetLink>
  );
}

export function QueueList({
  entries,
  selectedKey,
  emptyText,
  label,
}: {
  entries: ListEntry[];
  selectedKey: string | null;
  emptyText: string;
  label: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useScopeLayoutEffect(entries.length, () => {
    const element = anchorRef.current;
    if (!element) {
      return;
    }
    const measure = () =>
      setScrollMargin(Math.round(element.getBoundingClientRect().top + globalThis.scrollY));
    measure();
    // A list mounted hidden on narrow screens measures 0 until it is shown.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });

  const { virtualizer, virtualItems, totalSize } = useWindowVirtualizerFresh<HTMLDivElement>({
    count: entries.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    scrollMargin,
  });

  const selectedIndex = entries.findIndex((entry) => entry.key === selectedKey);
  useScopeEffect(selectedIndex, (index) => {
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: "auto" });
    }
  });

  if (entries.length === 0) {
    return <p className="text-muted-foreground px-3 py-6 text-sm">{emptyText}</p>;
  }

  return (
    <div
      ref={anchorRef}
      role="list"
      aria-label={label}
      className="relative"
      style={{ height: totalSize }}
    >
      {virtualItems.map((item) => {
        const entry = entries[item.index];
        if (entry === undefined) {
          return null;
        }
        return (
          <div
            key={entry.key}
            role="listitem"
            className="absolute inset-x-0 top-0"
            style={{ height: ROW_HEIGHT, transform: `translateY(${item.start - scrollMargin}px)` }}
          >
            <QueueRow entry={entry} selected={entry.key === selectedKey} />
          </div>
        );
      })}
    </div>
  );
}
