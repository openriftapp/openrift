import type { ReviewQueueItem } from "@openrift/shared/contracts/admin/catalog-review";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { getRouteApi, Link } from "@tanstack/react-router";
import { DatabaseIcon, UserIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text-link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { useReviewQueue } from "@/features/admin/hooks/use-catalog-review";
import type { ReviewFilter } from "@/features/admin/lib/review-queue";
import {
  countReviewKinds,
  REVIEW_FILTER_LABELS,
  REVIEW_FILTERS,
  REVIEW_KIND_LABELS,
  REVIEW_KIND_ORDER,
  REVIEW_KIND_PLURALS,
  REVIEW_KIND_TONES,
  reviewItemTarget,
  selectReviewItems,
  summarizeReviewItem,
} from "@/features/admin/lib/review-queue";

const routeApi = getRouteApi("/_app/_authenticated/admin/review");

type OpenTarget =
  | { to: "/admin/cards/$cardSlug"; params: { cardSlug: string } }
  | { to: "/admin/cards/new/$name"; params: { name: string } };

function openTarget(item: ReviewQueueItem): OpenTarget {
  const target = reviewItemTarget(item);
  if (target.kind === "card") {
    return { to: "/admin/cards/$cardSlug", params: { cardSlug: target.cardSlug } };
  }
  return { to: "/admin/cards/new/$name", params: { name: target.name } };
}

function submittedBy(item: ReviewQueueItem): string {
  return item.isContributor ? (item.submitterName ?? "Contributor") : item.provider;
}

function KindCell({ row }: AdminCellSlotProps<ReviewQueueItem>) {
  if (!row) {
    return null;
  }
  return <Badge variant={REVIEW_KIND_TONES[row.kind]}>{REVIEW_KIND_LABELS[row.kind]}</Badge>;
}

function CardCell({ row }: AdminCellSlotProps<ReviewQueueItem>) {
  if (!row) {
    return null;
  }
  return (
    <TextLink variant="inherit" className="font-medium" render={<Link {...openTarget(row)} />}>
      {row.cardName}
      {row.cardSlug && <span className="text-muted-foreground ml-2 text-xs">{row.cardSlug}</span>}
    </TextLink>
  );
}

function FromCell({ row }: AdminCellSlotProps<ReviewQueueItem>) {
  if (!row) {
    return null;
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1.5">
      {row.isContributor ? (
        <UserIcon className="size-3.5 shrink-0" />
      ) : (
        <DatabaseIcon className="size-3.5 shrink-0" />
      )}
      <span className="truncate">{submittedBy(row)}</span>
    </span>
  );
}

function ChangesCell({ row }: AdminCellSlotProps<ReviewQueueItem>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{summarizeReviewItem(row)}</span>;
}

function WaitingCell({ row }: AdminCellSlotProps<ReviewQueueItem>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{formatRelativeTime(row.createdAt)}</span>;
}

const columns: AdminColumnDef<ReviewQueueItem>[] = [
  {
    header: "Type",
    width: "w-28",
    sortValue: (row) => REVIEW_KIND_ORDER.indexOf(row.kind),
    cell: <KindCell />,
  },
  {
    header: "Card",
    sortValue: (row) => row.cardName,
    cell: <CardCell />,
  },
  {
    header: "From",
    width: "w-48",
    sortValue: submittedBy,
    cell: <FromCell />,
  },
  {
    header: "Changes",
    width: "w-56",
    sortValue: summarizeReviewItem,
    cell: <ChangesCell />,
  },
  {
    header: "Waiting",
    width: "w-28",
    sortValue: (row) => row.createdAt,
    cell: <WaitingCell />,
  },
];

export function ReviewInboxPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { data } = useReviewQueue();

  const filter: ReviewFilter = search.filter ?? "all";
  const query = search.q ?? "";

  const items = selectReviewItems(data?.items ?? [], filter, query);
  const kindCounts = countReviewKinds(items);

  const counts = data?.counts;
  const filterCounts: Record<ReviewFilter, number> = {
    all: counts?.open ?? 0,
    contributors: counts?.contributors ?? 0,
    sources: counts?.sources ?? 0,
  };

  return (
    <AdminTable
      title="Review"
      columns={columns}
      data={items}
      getRowKey={(item) => item.id}
      emptyText="Nothing waiting. Clear the search to see the whole queue."
      defaultSort={{ column: "Waiting", direction: "asc" }}
      minWidth="min-w-[820px]"
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <DebouncedSearchInput
            urlValue={query}
            placeholder="Search by card, source or contributor…"
            className="w-64"
            onCommit={(next) => {
              void navigate({
                replace: true,
                search: (prev) => ({ ...prev, q: next === "" ? undefined : next }),
              });
            }}
          />
          <ToggleGroup
            variant="outline"
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
      }
    />
  );
}
