import type { ReviewQueueItem } from "@openrift/shared/contracts/admin/catalog-review";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { useHotkey } from "@tanstack/react-hotkeys";
import { getRouteApi, Link } from "@tanstack/react-router";
import { DatabaseIcon, InboxIcon, UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { CardList, CardListRow } from "@/components/ui/card-list";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useReviewQueue } from "@/features/catalog-admin/hooks/use-catalog-review";
import type { ReviewFilter } from "@/features/catalog-admin/lib/review-queue";
import {
  countReviewKinds,
  oldestItemAgeDays,
  REVIEW_FILTER_LABELS,
  REVIEW_FILTERS,
  REVIEW_KIND_LABELS,
  REVIEW_KIND_ORDER,
  REVIEW_KIND_PLURALS,
  REVIEW_KIND_TONES,
  reviewItemTarget,
  selectReviewItems,
  summarizeReviewItem,
} from "@/features/catalog-admin/lib/review-queue";
import { cn } from "@/lib/utils";

const routeApi = getRouteApi("/_app/_authenticated/admin/catalog/review");

interface QueueSearch {
  from: "review";
  filter?: ReviewFilter;
  q?: string;
}

type OpenTarget =
  | {
      to: "/admin/catalog/cards/$cardSlug";
      params: { cardSlug: string };
      search: QueueSearch & { tab: "attention" };
    }
  | {
      to: "/admin/catalog/drafts/$name";
      params: { name: string };
      search: QueueSearch;
    };

function openTarget(item: ReviewQueueItem, queueSearch: QueueSearch): OpenTarget {
  const target = reviewItemTarget(item);
  if (target.kind === "card") {
    return {
      to: "/admin/catalog/cards/$cardSlug",
      params: { cardSlug: target.cardSlug },
      search: { ...queueSearch, tab: "attention" },
    };
  }
  return {
    to: "/admin/catalog/drafts/$name",
    params: { name: target.name },
    search: queueSearch,
  };
}

function ReviewRow({
  item,
  isFocused,
  queueSearch,
}: {
  item: ReviewQueueItem;
  isFocused: boolean;
  queueSearch: QueueSearch;
}) {
  const target = openTarget(item, queueSearch);
  const from = item.isContributor ? (item.submitterName ?? "Contributor") : item.provider;

  return (
    <li>
      <CardListRow render={<Link {...target} />} className={cn(isFocused && "bg-muted")}>
        <Badge variant={REVIEW_KIND_TONES[item.kind]} className="shrink-0">
          {REVIEW_KIND_LABELS[item.kind]}
        </Badge>
        <span className="min-w-0 flex-1 truncate">
          {item.cardName}
          {item.cardSlug && (
            <span className="text-muted-foreground ml-2 text-xs">{item.cardSlug}</span>
          )}
        </span>
        <span className="text-muted-foreground hidden w-40 shrink-0 items-center gap-1.5 truncate text-sm sm:flex">
          {item.isContributor ? (
            <UserIcon className="size-3.5 shrink-0" />
          ) : (
            <DatabaseIcon className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{from}</span>
        </span>
        <span className="text-muted-foreground hidden w-48 shrink-0 truncate text-sm md:block">
          {summarizeReviewItem(item)}
        </span>
        <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
          {formatRelativeTime(item.createdAt)}
        </span>
        <span className="text-muted-foreground w-12 shrink-0 text-right text-sm opacity-0 transition-opacity group-hover:opacity-100">
          Open
        </span>
      </CardListRow>
    </li>
  );
}

export function ReviewInboxPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { data, isLoading } = useReviewQueue();

  const filter: ReviewFilter = search.filter ?? "all";
  const query = search.q ?? "";
  const queueSearch: QueueSearch = { from: "review", filter: search.filter, q: search.q };
  const [focusedIndex, setFocusedIndex] = useState(0);

  const allItems = data?.items ?? [];
  const items = selectReviewItems(allItems, filter, query);
  const kindCounts = countReviewKinds(items);
  const oldestDays = oldestItemAgeDays(allItems);
  const focused = items.length === 0 ? -1 : Math.min(focusedIndex, items.length - 1);
  const focusedItem = focused === -1 ? undefined : items[focused];

  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const openRef = useRef<(item: ReviewQueueItem | undefined) => void>(() => {});
  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const moveRef = useRef<(delta: number) => void>(() => {});

  useHotkey("J", () => moveRef.current(1), { enabled: items.length > 0 });
  useHotkey("K", () => moveRef.current(-1), { enabled: items.length > 0 });
  useHotkey("Enter", () => openRef.current(focusedItem), { enabled: items.length > 0 });

  useEffect(() => {
    openRef.current = (item) => {
      if (item) {
        void navigate(openTarget(item, queueSearch));
      }
    };
  });
  useEffect(() => {
    moveRef.current = (delta) => {
      setFocusedIndex((prev) => Math.max(0, Math.min(items.length - 1, prev + delta)));
    };
  });

  const counts = data?.counts;
  const filterCounts: Record<ReviewFilter, number> = {
    all: counts?.open ?? 0,
    contributors: counts?.contributors ?? 0,
    sources: counts?.sources ?? 0,
  };
  const firstItem = items[0];

  return (
    <>
      <AdminPageTopBar
        title="Review"
        actions={
          firstItem ? (
            <PageTopBarPrimaryButton render={<Link {...openTarget(firstItem, queueSearch)} />}>
              Start reviewing
            </PageTopBarPrimaryButton>
          ) : undefined
        }
      />

      <div className="space-y-4 pt-3">
        <p className="text-muted-foreground text-sm">
          {filterCounts.all} open
          {oldestDays === null ? "" : ` · oldest ${oldestDays}d`}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={query}
            placeholder="Search by card, source or contributor…"
            className="w-64"
            onChange={(event) => {
              const next = event.target.value;
              void navigate({
                replace: true,
                search: (prev) => ({ ...prev, q: next === "" ? undefined : next }),
              });
            }}
          />
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[filter]}
            aria-label="Review filter"
            onValueChange={([next]) => {
              const match = REVIEW_FILTERS.find((option) => option === next);
              if (!match) {
                return;
              }
              void navigate({
                search: (prev) => ({ ...prev, filter: match === "all" ? undefined : match }),
              });
            }}
          >
            {REVIEW_FILTERS.map((option) => (
              <ToggleGroupItem key={option} value={option}>
                {REVIEW_FILTER_LABELS[option]} ({filterCounts[option]})
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex flex-wrap items-center gap-1.5">
            {REVIEW_KIND_ORDER.map((kind) => (
              <Badge key={kind} variant={REVIEW_KIND_TONES[kind]}>
                {REVIEW_KIND_PLURALS[kind]} {kindCounts[kind]}
              </Badge>
            ))}
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>Nothing waiting</EmptyTitle>
              <EmptyDescription>
                No submissions or sources match this filter. Clear the search to see the whole
                queue.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <CardList>
              {items.map((item, index) => (
                <ReviewRow
                  key={item.id}
                  item={item}
                  isFocused={index === focused}
                  queueSearch={queueSearch}
                />
              ))}
            </CardList>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd>
              <span>move</span>
              <Kbd>↵</Kbd>
              <span>open</span>
            </p>
          </>
        )}
      </div>
    </>
  );
}
