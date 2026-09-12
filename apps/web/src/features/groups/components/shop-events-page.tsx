import { dateLeafParts, formatTimeLocal } from "@openrift/shared/format-date";
import type {
  FriendGroupDetailResponse,
  FriendGroupShopEventResponse,
} from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, StoreIcon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageDescription } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { DateLeaf } from "@/components/ui/date-leaf";
import { RowList } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isAdmin } from "@/features/groups/components/friend-group-shell";
import { HOVER_ROW_CLASS } from "@/features/groups/components/hover-row";
import { useFriendGroupShopEvents } from "@/features/groups/hooks/use-friend-group-shops";
import type { ShopEventRange } from "@/features/groups/lib/shop-events";
import {
  filterShopEvents,
  filterShopEventsByRange,
  groupShopEventsByDay,
} from "@/features/groups/lib/shop-events";
import { m } from "@/paraglide/messages.js";

const ALL_SHOPS = "all";

function ranges(): { value: ShopEventRange; label: string }[] {
  return [
    { value: "upcoming", label: m.groups_shops_range_upcoming() },
    { value: "past", label: m.groups_shops_range_past() },
    { value: "all", label: m.common_all() },
  ];
}

function toRange(value: string | undefined): ShopEventRange {
  return value === "past" || value === "all" ? value : "upcoming";
}

function rangeWindowLabel(range: ShopEventRange, pastDays: number, horizonDays: number): string {
  if (range === "past") {
    return m.groups_shops_window_past({ days: pastDays });
  }
  if (range === "all") {
    return m.groups_shops_window_all({ past: pastDays, ahead: horizonDays });
  }
  return m.groups_shops_window_next({ days: horizonDays });
}

export function ShopEventsContent({
  slug,
  data,
}: {
  slug: string;
  data: FriendGroupDetailResponse;
}) {
  const { data: feed } = useFriendGroupShopEvents(slug);
  const [shopFilter, setShopFilter] = useState<string>(ALL_SHOPS);
  const [range, setRange] = useState<ShopEventRange>("upcoming");

  if (feed.shops.length === 0) {
    return (
      <EmptyState
        icon={StoreIcon}
        title={m.groups_shops_empty_title()}
        description={
          isAdmin(data.viewerRole) ? m.groups_shops_empty_admin() : m.groups_shops_empty_member()
        }
      >
        {isAdmin(data.viewerRole) ? (
          <Button render={<Link to="/groups/$slug/manage" params={{ slug }} hash="shops" />}>
            {m.groups_link_a_shop()}
          </Button>
        ) : null}
      </EmptyState>
    );
  }

  const selectedStoreId = shopFilter === ALL_SHOPS ? null : Number(shopFilter);
  const events = filterShopEventsByRange(filterShopEvents(feed.items, selectedStoreId), range);
  const days = groupShopEventsByDay(events, new Date(), range === "past" ? "desc" : "asc");
  const windowLabel = rangeWindowLabel(range, feed.pastDays, feed.horizonDays);

  return (
    <div className="flex flex-col gap-6">
      <PageDescription>{m.groups_shops_page_description()}</PageDescription>

      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[range]}
          onValueChange={([next]) => setRange(toRange(next))}
          aria-label={m.groups_shops_range_aria()}
        >
          {ranges().map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {feed.shops.length > 1 ? (
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[shopFilter]}
            onValueChange={([next]) => setShopFilter(next ?? ALL_SHOPS)}
            aria-label={m.groups_shops_filter_aria()}
          >
            <ToggleGroupItem value={ALL_SHOPS}>{m.groups_shops_all_shops()}</ToggleGroupItem>
            {feed.shops.map((shop) => (
              <ToggleGroupItem key={shop.storeId} value={String(shop.storeId)}>
                {shop.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <span className="text-muted-foreground ml-auto text-xs">
          {windowLabel} ·{" "}
          {events.length === 1
            ? m.groups_shops_event_count_one({ count: events.length })
            : m.groups_shops_event_count_other({ count: events.length })}
        </span>
      </div>

      {days.length === 0 ? (
        <p className="text-muted-foreground">{m.groups_shops_nothing_in_range()}</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {days.map((day) => {
            const leaf = dateLeafParts(`${day.day}T00:00:00`);
            return (
              <li
                key={day.day}
                className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3"
              >
                <DateLeaf month={leaf.month} day={leaf.day} size="sm" className="mt-1" />
                <div className="flex min-w-0 flex-col gap-1">
                  <SectionHeading as="h3" size="sm">
                    {day.label}
                  </SectionHeading>
                  <RowList>
                    {day.events.map((event) => (
                      <li key={event.externalId}>
                        <ShopEventRow event={event} showShop={selectedStoreId === null} />
                      </li>
                    ))}
                  </RowList>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ShopEventRow({
  event,
  showShop,
}: {
  event: FriendGroupShopEventResponse;
  showShop: boolean;
}) {
  const meta = [
    formatTimeLocal(event.startAt),
    ...(showShop ? [event.storeName] : []),
    ...(event.eventFormat === null ? [] : [event.eventFormat]),
  ].join(" · ");

  return (
    <a href={event.url} target="_blank" rel="noreferrer" className={HOVER_ROW_CLASS}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{event.name}</span>
        <span className="text-muted-foreground truncate text-xs">{meta}</span>
      </span>
      <ExternalLinkIcon className="text-muted-foreground/40 size-4 shrink-0" />
    </a>
  );
}
