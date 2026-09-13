import type { MetaDeckSummary, MetaEventSummary } from "@openrift/shared/types/api/meta";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarBack,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { RowList } from "@/components/ui/row-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MetaArchiveDeckTile } from "@/features/meta/components/meta-archive-deck-tile";
import { MetaDeckCostsBridge } from "@/features/meta/components/meta-deck-costs-bridge";
import { MetaDeckFilterControls } from "@/features/meta/components/meta-deck-filter-controls";
import { DECK_INDEX_GRID, MetaDeckIndexRow } from "@/features/meta/components/meta-deck-index-row";
import { IndexSortButton } from "@/features/meta/components/meta-index-sort-button";
import { MetaShowMore } from "@/features/meta/components/meta-show-more";
import { useMetaDecks, useMetaEvents } from "@/features/meta/hooks/use-meta";
import { useMetaDeckFilters } from "@/features/meta/hooks/use-meta-deck-filters";
import { useMetaEras } from "@/features/meta/hooks/use-meta-eras";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import {
  countMetaDecksUnderCost,
  curateMetaDecks,
  filterMetaDecks,
  metaDeckSortPresets,
  metaDeckFilterCounts,
  metaDeckFilterOptions,
  sortMetaDecks,
} from "@/features/meta/lib/meta-deck-filters";
import type { MetaDeckSort, MetaDeckSortDirection } from "@/features/meta/lib/meta-deck-search";
import { metaEventFieldSize, metaShownLabel } from "@/features/meta/lib/meta-format";
import { resolveScopeRange, scopeKey } from "@/features/meta/lib/meta-scope";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/lib/auth-session";
import type { MetaDeckView } from "@/lib/sanitize-preferences";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

/** How many lists the page opens with, and how many each "more" adds. */
const PAGE_SIZE = 40;

function highest(
  costs: ReadonlyMap<string, MetaDeckCost> | undefined,
  pick: (cost: MetaDeckCost) => number | undefined,
): number | undefined {
  if (costs === undefined) {
    return undefined;
  }
  let top: number | undefined;
  for (const cost of costs.values()) {
    const value = pick(cost);
    if (value !== undefined && (top === undefined || value > top)) {
      top = value;
    }
  }
  return top;
}

function MetaDeckBrowserFallback() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * Mounts only after hydration: the archive is a multi-megabyte payload, and
 * anything the server touches here is dehydrated into the HTML document.
 */
function MetaDeckBrowser({ onCount }: { onCount: (shown: number, total: number) => void }) {
  const filters = useMetaDeckFilters();
  const eras = useMetaEras();
  const range = resolveScopeRange(filters.scope, eras);
  const { data } = useMetaDecks(range);
  const { data: eventsData } = useMetaEvents();
  const { data: session } = useSession();
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const view = useDisplayStore((state) => state.metaDeckView);
  const setView = useDisplayStore((state) => state.setMetaDeckView);
  const [costs, setCosts] = useState<ReadonlyMap<string, MetaDeckCost>>();

  const signedIn = Boolean(session?.user);
  const values = {
    scope: filters.scope,
    eras,
    events: filters.events,
    legends: filters.legends,
    maxRank: filters.maxRank,
    maxCost: signedIn ? filters.maxCost : null,
    valueMin: filters.valueRange.min,
    valueMax: filters.valueRange.max,
    includeSideboard: filters.includeSideboard,
    showAll: filters.showAll,
  };
  const context = { costs };

  const options = metaDeckFilterOptions(data.decks);
  const counts = metaDeckFilterCounts(data.decks, values, context);
  const matching = filterMetaDecks(data.decks, values, context);
  const decks = sortMetaDecks(
    curateMetaDecks(matching, values),
    filters.sort,
    filters.direction,
    costs,
  );
  const summaries = new Map(eventsData.events.map((event) => [event.slug, event]));
  const eventCount = new Set(decks.map((deck) => deck.event.slug)).size;
  const shown = decks.length;
  const total = data.total;
  useEffect(() => {
    onCount(shown, total);
  }, [onCount, shown, total]);

  const cost = {
    ready: costs !== undefined,
    withCollection: signedIn,
    countUnderCost: (maxCost: number | null) =>
      countMetaDecksUnderCost(data.decks, values, context, maxCost),
    maxToComplete: highest(costs, (entry) => entry.toComplete),
    maxValue: highest(costs, (entry) => entry.value),
  };

  // Reordering is not renarrowing: the same lists in a new order keep their
  // depth, so the sort keys are deliberately absent here.
  const listKey = [
    scopeKey(filters.scope),
    filters.events.join(","),
    filters.legends.join(","),
    filters.maxRank ?? "",
    filters.maxCost ?? "",
    filters.valueRange.min ?? "",
    filters.valueRange.max ?? "",
    filters.showAll ? "all" : "best",
  ].join("|");

  return (
    <>
      <Suspense fallback={null}>
        <MetaDeckCostsBridge
          includeSideboard={filters.includeSideboard}
          withCollection={signedIn}
          range={range}
          onChange={setCosts}
        />
      </Suspense>

      <MetaDeckFilterControls options={options} counts={counts} eras={eras} cost={cost} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ViewToggle view={view} onChange={setView} />
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[filters.showAll ? "all" : "best"]}
          onValueChange={([next]) => {
            if (next === "best" || next === "all") {
              filters.setShowAll(next === "all");
            }
          }}
          aria-label={m.meta_browser_lists_shown()}
        >
          <ToggleGroupItem value="best">{m.meta_browser_best_per_legend()}</ToggleGroupItem>
          <ToggleGroupItem value="all">{m.meta_browser_every_list()}</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-muted-foreground text-sm tabular-nums">
          {decks.length} {decks.length === 1 ? "deck" : "decks"} · {eventCount}{" "}
          {eventCount === 1 ? "event" : "events"}
        </p>
        {view === "grid" && (
          <SortSelect
            sort={filters.sort}
            direction={filters.direction}
            onChange={(sort, direction) => filters.setSort(sort, direction)}
            className="ml-auto"
          />
        )}
      </div>

      {view === "list" ? (
        <div className="mt-6 text-sm">
          <SortHeader
            sort={filters.sort}
            direction={filters.direction}
            onSort={(column) => filters.sortBy(column)}
          />
          {decks.length === 0 ? (
            <NoMatches />
          ) : (
            <DeckList
              key={listKey}
              decks={decks}
              summaries={summaries}
              costs={costs}
              marketplace={marketplace}
            />
          )}
        </div>
      ) : decks.length === 0 ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyDescription>{m.meta_browser_no_match()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="mt-6">
          <DeckGrid
            key={listKey}
            decks={decks}
            summaries={summaries}
            costs={costs}
            marketplace={marketplace}
          />
        </div>
      )}
    </>
  );
}

function NoMatches() {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyDescription>{m.meta_browser_no_match()}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: MetaDeckView;
  onChange: (view: MetaDeckView) => void;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[view]}
      onValueChange={([next]) => {
        if (next === "list" || next === "grid") {
          onChange(next);
        }
      }}
      aria-label={m.meta_browser_layout()}
    >
      <ToggleGroupItem value="list">
        <ListIcon aria-hidden />
        {m.meta_browser_view_list()}
      </ToggleGroupItem>
      <ToggleGroupItem value="grid">
        <LayoutGridIcon aria-hidden />
        {m.meta_browser_view_grid()}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

const presetKey = (sort: MetaDeckSort, direction: MetaDeckSortDirection) => `${sort}:${direction}`;

/** The grid's order, as one menu: a grid has no column headers to click. */
function SortSelect({
  sort,
  direction,
  onChange,
  className,
}: {
  sort: MetaDeckSort;
  direction: MetaDeckSortDirection;
  onChange: (sort: MetaDeckSort, direction: MetaDeckSortDirection) => void;
  className?: string;
}) {
  const items: Record<string, string> = {};
  for (const preset of metaDeckSortPresets()) {
    items[presetKey(preset.sort, preset.direction)] = preset.label;
  }
  const current = presetKey(sort, direction);
  const value = current in items ? current : presetKey("date", "desc");
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const preset = metaDeckSortPresets().find(
          (entry) => presetKey(entry.sort, entry.direction) === next,
        );
        if (preset !== undefined) {
          onChange(preset.sort, preset.direction);
        }
      }}
      items={items}
    >
      <SelectTrigger size="sm" className={cn("w-48", className)} aria-label={m.meta_browser_sort()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([itemValue, label]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SortButton = IndexSortButton<MetaDeckSort>;

/**
 * The column labels, each a sort control where the column has one. Hidden on
 * phones, where the rows are cards and there is nothing for a header to label.
 */
function SortHeader({
  sort,
  direction,
  onSort,
}: {
  sort: MetaDeckSort;
  direction: MetaDeckSortDirection;
  onSort: (column: MetaDeckSort) => void;
}) {
  return (
    <div
      className={cn(
        DECK_INDEX_GRID,
        "border-border text-muted-foreground -mx-2 hidden border-b px-2 py-2 text-xs font-semibold sm:grid",
      )}
    >
      <SortButton column="finish" sort={sort} direction={direction} onSort={onSort}>
        {m.meta_filter_finish()}
      </SortButton>
      <span />
      <span>{m.meta_standings_col_legend()}</span>
      <span>{m.meta_standings_col_player()}</span>
      <span>{m.meta_finishes_col_event()}</span>
      <SortButton column="date" sort={sort} direction={direction} onSort={onSort}>
        {m.meta_col_date()}
      </SortButton>
      <SortButton column="value" sort={sort} direction={direction} onSort={onSort} align="end">
        {m.meta_standings_col_value()}
      </SortButton>
      <SortButton column="cost" sort={sort} direction={direction} onSort={onSort}>
        {m.meta_cost_to_complete()}
      </SortButton>
    </div>
  );
}

interface DeckListProps {
  decks: MetaDeckSummary[];
  summaries: ReadonlyMap<string, MetaEventSummary>;
  costs?: ReadonlyMap<string, MetaDeckCost>;
  marketplace: Marketplace;
}

function fieldSizeOf(summary: MetaEventSummary | undefined): number | null {
  return summary === undefined ? null : metaEventFieldSize(summary);
}

function DeckList({ decks, summaries, costs, marketplace }: DeckListProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const remaining = decks.length - shown;

  return (
    <>
      <RowList className="flex flex-col">
        {decks.slice(0, shown).map((deck) => (
          <li key={deck.deckId}>
            <MetaDeckIndexRow
              deck={deck}
              cost={costs?.get(deck.deckId)}
              fieldSize={fieldSizeOf(summaries.get(deck.event.slug))}
              marketplace={marketplace}
            />
          </li>
        ))}
      </RowList>
      {remaining > 0 && (
        <MetaShowMore onClick={() => setShown(shown + PAGE_SIZE)}>
          {remaining.toLocaleString("en-US")} more {remaining === 1 ? "deck" : "decks"}
        </MetaShowMore>
      )}
    </>
  );
}

function DeckGrid({ decks, summaries, costs, marketplace }: DeckListProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const remaining = decks.length - shown;

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {decks.slice(0, shown).map((deck) => (
          <li key={deck.deckId}>
            <MetaArchiveDeckTile
              deck={deck}
              cost={costs?.get(deck.deckId)}
              fieldSize={fieldSizeOf(summaries.get(deck.event.slug)) ?? undefined}
              marketplace={marketplace}
              showEvent
            />
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <MetaShowMore onClick={() => setShown(shown + PAGE_SIZE)}>
          Show {Math.min(PAGE_SIZE, remaining)} more of {remaining.toLocaleString("en-US")}
        </MetaShowMore>
      )}
    </>
  );
}

// The endpoint hands over the scoped archive and every filter runs
// client-side, so one cacheable payload serves every view.
export function MetaDeckBrowserPage() {
  const hydrated = useHydrated();
  const [count, setCount] = useState<{ shown: number; total: number }>();
  const onCount = (shown: number, total: number) => {
    setCount((prev) => (prev?.shown === shown && prev.total === total ? prev : { shown, total }));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageTopBarSticky width="full">
        <PageTopBar>
          <PageTopBarBack to="/meta" aria-label={m.meta_back_to_archive_aria()} />
          <PageTopBarTitle>{m.meta_browser_title()}</PageTopBarTitle>
          {count !== undefined && (
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {metaShownLabel(count.shown, count.total, "decks")}
            </span>
          )}
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.full, "px-safe pt-3 pb-6")}>
        <PageDescription className="pb-4">{m.meta_decks_page_description()}</PageDescription>

        {hydrated ? (
          <Suspense fallback={<MetaDeckBrowserFallback />}>
            <MetaDeckBrowser onCount={onCount} />
          </Suspense>
        ) : (
          <MetaDeckBrowserFallback />
        )}
      </div>
    </div>
  );
}
