import { formatRelativeTime } from "@openrift/shared/format-date";
import type { MetaActivityItem } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import { CalendarPlusIcon, ChevronRightIcon, ListOrderedIcon, ListPlusIcon } from "lucide-react";
import type { ComponentType } from "react";

import { RowList, RowListItem, RowListLink } from "@/components/ui/row-list";

const KIND_ICON: Record<MetaActivityItem["kind"], ComponentType<{ className?: string }>> = {
  "event-added": CalendarPlusIcon,
  "decks-added": ListPlusIcon,
  "results-added": ListOrderedIcon,
};

function itemHeadline(item: MetaActivityItem): string {
  switch (item.kind) {
    case "event-added": {
      return "New event on record";
    }
    case "decks-added": {
      return item.count === 1 ? "1 decklist added" : `${item.count} decklists added`;
    }
    case "results-added": {
      return item.count === 1 ? "1 result added" : `${item.count} results added`;
    }
  }
}

function ActivityRow({ item }: { item: MetaActivityItem }) {
  const Icon = KIND_ICON[item.kind];

  return (
    <RowListLink
      render={<Link to="/meta/$slug" params={{ slug: item.event.slug }} />}
      className="focus-visible:ring-ring/50 outline-none focus-visible:ring-2"
    >
      <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
        <Icon aria-hidden className="size-3.5" />
      </span>
      {/* The event takes its own line: sharing one with the headline truncated it away in a 20rem rail. */}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{itemHeadline(item)}</span>
        <span className="truncate">{item.event.name}</span>
        <span className="text-muted-foreground text-xs">{formatRelativeTime(item.occurredAt)}</span>
      </span>
      <ChevronRightIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
    </RowListLink>
  );
}

export function MetaArchiveActivity({ items }: { items: readonly MetaActivityItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <RowList>
      {items.map((item) => (
        <RowListItem key={`${item.kind}-${item.event.slug}-${item.occurredAt}`}>
          <ActivityRow item={item} />
        </RowListItem>
      ))}
    </RowList>
  );
}
