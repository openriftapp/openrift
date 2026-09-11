import type { AdminAuditEventResponse } from "@openrift/shared/contracts/admin/audit-events";
import { formatDayTime } from "@openrift/shared/format-date";
import { LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuditEvents } from "@/features/admin/hooks/use-admin-audit";
import type {
  HistoryContext,
  HistoryFilter,
  HistoryTarget,
} from "@/features/admin/lib/history-events";
import {
  filterHistoryEvents,
  historyTarget,
  HISTORY_FILTER_LABELS,
  HISTORY_FILTERS,
  historySentence,
  SUBMISSION_OUTCOME_LABELS,
  submissionOutcome,
} from "@/features/admin/lib/history-events";
import { useUserId } from "@/lib/auth-session";

// The endpoint matches the card as a substring across three columns, so a page
// can hold no rows for this card; pull a few more before handing over the button.
const ROWS_PER_SCREEN = 12;
const AUTO_PAGES = 5;

const TARGET_LABELS: Record<HistoryTarget["kind"], string> = {
  printing: "Open the printing",
  bans: "Open bans & errata",
  fields: "Open the card fields",
  sources: "Open sources",
  submissions: "Open attention",
};

function isHistoryFilter(value: string | undefined): value is HistoryFilter {
  return HISTORY_FILTERS.some((entry) => entry === value);
}

function actorName(event: AdminAuditEventResponse, userId: string | null): string {
  if (event.actorUserId === userId) {
    return "you";
  }
  return event.actorName ?? event.actorEmail ?? "someone";
}

function HistoryRow({
  event,
  userId,
  context,
  onOpen,
}: {
  event: AdminAuditEventResponse;
  userId: string | null;
  context: HistoryContext;
  onOpen?: (target: HistoryTarget) => void;
}) {
  const outcome = submissionOutcome(event);
  const target = onOpen === undefined ? null : historyTarget(event);
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm">
      <span className="text-muted-foreground w-36 shrink-0 font-mono">
        {formatDayTime(event.createdAt)}
      </span>
      <span className="min-w-0 flex-1">
        {historySentence(event, context)}{" "}
        <span className="text-muted-foreground">by {actorName(event, userId)}</span>
      </span>
      {outcome !== null && (
        <Badge variant={outcome === "accepted" ? "success" : "muted"}>
          {SUBMISSION_OUTCOME_LABELS[outcome]}
        </Badge>
      )}
      {target !== null && onOpen !== undefined && (
        <Button variant="link" size="xs" onClick={() => onOpen(target)}>
          {TARGET_LABELS[target.kind]}
        </Button>
      )}
    </li>
  );
}

export function CardHistorySection({
  cardSlug,
  cardName,
  printingLabels,
  onOpen,
}: {
  cardSlug: string;
  cardName: string;
  printingLabels?: Record<string, string>;
  onOpen?: (target: HistoryTarget) => void;
}) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const userId = useUserId();
  const events = useAuditEvents({ search: cardSlug });

  const loaded = events.data?.pages.flatMap((page) => page.items) ?? [];
  const rows = filterHistoryEvents(loaded, { slug: cardSlug, name: cardName }, filter);
  const busy = events.isPending || events.isFetchingNextPage;
  const pagesLoaded = events.data?.pages.length ?? 0;
  const wantsMore = rows.length < ROWS_PER_SCREEN && pagesLoaded < AUTO_PAGES && events.hasNextPage;

  useEffect(() => {
    if (wantsMore && !busy) {
      void events.fetchNextPage();
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          spacing={0}
          aria-label="History shown"
          value={[filter]}
          onValueChange={([next]) => {
            if (isHistoryFilter(next)) {
              setFilter(next);
            }
          }}
        >
          {HISTORY_FILTERS.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {HISTORY_FILTER_LABELS[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-muted-foreground text-sm">Times are UTC.</p>
      </div>

      {events.isError && (
        <p className="text-muted-foreground text-sm">
          The change log could not be loaded. Reading it takes full admin access.
        </p>
      )}

      {rows.length > 0 && (
        <CardList>
          {rows.map((event) => (
            <HistoryRow
              key={event.id}
              event={event}
              userId={userId}
              context={{ printingLabels }}
              onOpen={onOpen}
            />
          ))}
        </CardList>
      )}

      {events.isPending && <Skeleton className="h-24 w-full" />}

      {!busy && !events.isError && !events.hasNextPage && rows.length === 0 && (
        <Empty>
          <EmptyDescription>
            {filter === "all"
              ? "Nothing has happened to this card yet."
              : "Nothing in this group yet."}
          </EmptyDescription>
        </Empty>
      )}

      {!busy && events.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void events.fetchNextPage()}>
            Load more
          </Button>
        </div>
      )}

      {events.isFetchingNextPage && (
        <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
          <LoaderIcon className="size-4 animate-spin" />
          Looking further back
        </p>
      )}
    </div>
  );
}
