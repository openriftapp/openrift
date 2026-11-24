import { countNoun } from "@openrift/shared/strings";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  ReadyTable,
  ReviewQueueTable,
} from "@/features/catalog-workspace/components/review-tables";
import { readyPreviewQueryOptions } from "@/features/catalog-workspace/hooks/use-workspace-batch";
import { useCardView } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import {
  reviewCardsQueryOptions,
  selectReviewQueue,
} from "@/features/catalog-workspace/lib/review-cards";
import type { CardView } from "@/features/catalog-workspace/lib/workspace-search";

type Segment = CardView | "all";

/** `listAllowed` is false for desk-only roles: they get the review segments without the card list. */
export function CardsBody({
  listAllowed,
  query,
  onQuery,
  onView,
  allCount,
  allFilter,
  allTable,
}: {
  listAllowed: boolean;
  query: string;
  onQuery: (query: string) => void;
  onView: (view: CardView | undefined) => void;
  allCount: ReactNode;
  allFilter: ReactNode;
  allTable: ReactNode;
}) {
  const view = useCardView();
  const { data: access } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const { data } = useQuery(reviewCardsQueryOptions());
  const { data: preview } = useQuery({ ...readyPreviewQueryOptions(), enabled: isAdmin });
  const cards = data?.cards ?? [];
  const review = selectReviewQueue(cards, "review");
  const images = selectReviewQueue(cards, "images");
  const readyCount = (preview?.cards.count ?? 0) + (preview?.printings.count ?? 0);

  const segments: { value: Segment; label: string }[] = [
    ...(listAllowed ? [{ value: "all" as const, label: "All" }] : []),
    { value: "review", label: `Needs review ${review.length}` },
    { value: "images", label: `New images ${images.length}` },
    ...(isAdmin ? [{ value: "ready" as const, label: `Ready to accept ${readyCount}` }] : []),
  ];
  const fallback: Segment = listAllowed ? "all" : "review";
  const active: Segment =
    view !== undefined && segments.some((segment) => segment.value === view) ? view : fallback;

  const controls = (
    <>
      <DebouncedSearchInput
        urlValue={query}
        onCommit={onQuery}
        placeholder={active === "all" ? "Name or code…" : "Search cards or sources…"}
        className="w-full sm:w-72"
      />
      {active === "all" && allFilter}
      <ToggleGroup
        variant="outline"
        spacing={0}
        value={[active]}
        aria-label="Show"
        className="max-w-full min-w-0 overflow-x-auto *:shrink-0 max-sm:w-full"
        onValueChange={([next]) => {
          const segment = segments.find((entry) => entry.value === next)?.value;
          if (segment !== undefined) {
            onView(segment === "all" ? undefined : segment);
          }
        }}
      >
        {segments.map((segment) => (
          <ToggleGroupItem key={segment.value} value={segment.value}>
            {segment.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </>
  );

  if (active === "ready") {
    return <ReadyTable reviewCards={cards} query={query} toolbarStart={controls} />;
  }
  if (active === "all") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          {allCount}
        </div>
        {allTable}
      </div>
    );
  }
  const queue = active === "images" ? images : review;
  return (
    <ReviewQueueTable
      cards={queue}
      query={query}
      emptyText={
        active === "images" ? "No new image is waiting." : "Nothing is waiting for review."
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <span className="text-muted-foreground text-sm">{countNoun(queue.length, "card")}</span>
        </div>
      }
    />
  );
}
