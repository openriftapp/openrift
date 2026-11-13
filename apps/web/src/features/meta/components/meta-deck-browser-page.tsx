import { formatDay } from "@openrift/shared/format-date";
import type { MetaDeckSummary, MetaEventSummary } from "@openrift/shared/types/api/meta";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { Link } from "@tanstack/react-router";
import { LayoutGridIcon, ListIcon, LogInIcon } from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarBack,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { PAGER_SCROLL_TARGET, Pager } from "@/components/ui/pager";
import { RowList, RowListLink } from "@/components/ui/row-list";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MetaArchiveDeckTile } from "@/features/meta/components/meta-archive-deck-tile";
import { MetaDeckCostsBridge } from "@/features/meta/components/meta-deck-costs-bridge";
import { MetaDeckFilterControls } from "@/features/meta/components/meta-deck-filter-controls";
import { deckIndexGrid, MetaDeckIndexRow } from "@/features/meta/components/meta-deck-index-row";
import { MetaEventHeading } from "@/features/meta/components/meta-event-row";
import {
  IndexSortButton,
  IndexSortHeader,
} from "@/features/meta/components/meta-index-sort-button";
import { MetaPageSizePicker } from "@/features/meta/components/meta-page-size-picker";
import { MetaScopeEmpty } from "@/features/meta/components/meta-scope-empty";
import { useMetaDeckFacets, useMetaDecks } from "@/features/meta/hooks/use-meta";
import { useMetaDeckFilters } from "@/features/meta/hooks/use-meta-deck-filters";
import { useMetaEras } from "@/features/meta/hooks/use-meta-eras";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import { partialListDeckIds } from "@/features/meta/lib/meta-deck-collection";
import {
  effectiveDeckSort,
  filterDecksByCost,
  groupDecksByEvent,
  metaDeckQueryFromFilters,
  metaDeckSortPresets,
  sortMetaDecks,
} from "@/features/meta/lib/meta-deck-filters";
import type { MetaDeckSort, MetaDeckSortDirection } from "@/features/meta/lib/meta-deck-search";
import {
  DEFAULT_DECK_PAGE_SIZE,
  isBrowserDeckSort,
  serverDeckOrder,
} from "@/features/meta/lib/meta-deck-search";
import { metaEventFieldSize, metaShownLabel } from "@/features/meta/lib/meta-format";
import type { MetaPageSizeValue } from "@/features/meta/lib/meta-paging";
import { metaPageCount, metaPageSlice } from "@/features/meta/lib/meta-paging";
import { scopeKey } from "@/features/meta/lib/meta-scope";
import { isCostFilterActive } from "@/features/meta/lib/meta-standings-cost";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/hooks/use-session";
import { useSignInSearch } from "@/hooks/use-sign-in-search";
import { useSmUp } from "@/hooks/use-sm-up";
import type { MetaDeckView } from "@/lib/sanitize-preferences";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

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

const DECK_LIST_ID = "meta-deck-list";

type ControlSize = "sm" | "default";

interface DeckCount {
  matched: number;
  archive: number;
  events: number;
  onPage: number | null;
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
 * Mounts only after hydration: the collection overlay reads a live query, and
 * anything the server touches here is dehydrated into the HTML document.
 *
 * The API pages and narrows the archive. Cost and value are priced in the
 * browser, so those two filters and their sorts work on the page on screen.
 */
function MetaDeckBrowser({
  signedIn,
  onCount,
}: {
  signedIn: boolean;
  onCount: (count: DeckCount) => void;
}) {
  const filters = useMetaDeckFilters();
  const eras = useMetaEras();
  const { sort, direction } = effectiveDeckSort(filters.sort, filters.direction, signedIn);
  const narrowing = metaDeckQueryFromFilters(filters, eras);
  const page = {
    ...narrowing,
    ...serverDeckOrder(sort, direction),
    ...metaPageSlice(filters.page, filters.perPage),
  };
  const { data } = useMetaDecks(page);
  const { data: facets } = useMetaDeckFacets(narrowing);
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const view = useDisplayStore((state) => state.metaDeckView);
  const setView = useDisplayStore((state) => state.setMetaDeckView);
  const smUp = useSmUp();
  const [costs, setCosts] = useState<ReadonlyMap<string, MetaDeckCost>>();
  const [eraPickerOpen, setEraPickerOpen] = useState(false);

  // A priced bound narrows the page in the browser, so an emptied page is not
  // the same thing as a page past the end of the results.
  const costActive = isCostFilterActive({
    maxCost: signedIn ? filters.maxCost : null,
    valueRange: filters.valueRange,
  });
  const priced = {
    maxCost: signedIn ? filters.maxCost : null,
    valueMin: filters.valueRange.min,
    valueMax: filters.valueRange.max,
  };

  const matching = filterDecksByCost(data.decks, priced, costs);
  const decks = sortMetaDecks(matching, sort, direction, costs);
  const summaries = new Map(data.events.map((event) => [event.slug, event]));
  const grouped = sort === "date";
  const total = data.total;
  const archiveTotal = data.archiveTotal;
  const eventCount = data.eventCount;
  const onPage = costActive ? decks.length : null;
  useEffect(() => {
    onCount({ matched: total, archive: archiveTotal, events: eventCount, onPage });
  }, [onCount, total, archiveTotal, eventCount, onPage]);

  const cost = {
    ready: costs !== undefined,
    withCollection: signedIn,
    countUnderCost: (maxCost: number | null) =>
      filterDecksByCost(data.decks, { ...priced, maxCost }, costs).length,
    maxToComplete: highest(costs, (entry) => entry.toComplete),
    maxValue: highest(costs, (entry) => entry.value),
  };

  const sortSelect = (size: ControlSize, className: string) => (
    <SortSelect
      sort={sort}
      direction={direction}
      withCollection={signedIn}
      onChange={(nextSort, nextDirection) => filters.setSort(nextSort, nextDirection)}
      size={size}
      className={className}
    />
  );
  const bestToggle = (size: "xs" | "sm") => (
    <Button
      type="button"
      variant="control"
      size={size}
      aria-pressed={!filters.showAll}
      aria-label={m.meta_browser_best_per_legend_aria()}
      onClick={() => filters.setShowAll(!filters.showAll)}
    >
      {m.meta_browser_best_per_legend()}
    </Button>
  );
  const sortHint = isBrowserDeckSort(sort) && (
    <p className={cn("text-muted-foreground text-2xs", !smUp && "mt-2")}>
      {m.meta_sort_page_only()}
    </p>
  );

  const emptyState = (className: string) =>
    total === 0 ? (
      <MetaScopeEmpty
        className={className}
        scope={filters.scope}
        eras={eras}
        setScope={filters.setScope}
        onPickEra={() => setEraPickerOpen(true)}
        fallback={m.meta_browser_no_match()}
        filtered={
          filters.events.length > 0 || filters.legends.length > 0 || filters.maxRank !== null
        }
      />
    ) : (
      <Empty className={className}>
        <EmptyHeader>
          <EmptyDescription>
            {costActive ? m.meta_browser_no_match() : m.meta_page_past_end()}
          </EmptyDescription>
        </EmptyHeader>
        {!costActive && (
          <EmptyContent>
            <Button variant="outline" onClick={() => filters.setPage(1)}>
              {m.meta_page_first()}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );

  const handlePageChange = (next: number) => filters.setPage(next);
  const handlePerPageChange = (next: MetaPageSizeValue) => filters.setPerPage(next);

  // The sort keys are deliberately absent: a re-sort keeps the rows mounted,
  // and with them each thumbnail's record of the source that failed to load.
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
    <div>
      <Suspense fallback={null}>
        <MetaDeckCostsBridge
          includeSideboard={filters.includeSideboard}
          withCollection={signedIn}
          decks={page}
          partialDeckIds={partialListDeckIds(data.decks)}
          onChange={setCosts}
        />
      </Suspense>

      <MetaDeckFilterControls
        facets={facets}
        eras={eras}
        cost={cost}
        phoneToolbar={
          smUp ? undefined : (
            <>
              {sortSelect("default", "w-auto min-w-0 flex-1")}
              <ViewToggle view={view} onChange={setView} size="default" />
            </>
          )
        }
        phoneStripLead={smUp ? undefined : bestToggle("xs")}
        eraPickerOpen={eraPickerOpen}
        onEraPickerOpenChange={setEraPickerOpen}
      />

      {smUp ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ViewToggle view={view} onChange={setView} size="sm" />
          {bestToggle("sm")}
          {sortHint}
          {sortSelect("sm", "ml-auto")}
        </div>
      ) : (
        sortHint
      )}

      <div id={DECK_LIST_ID} className={PAGER_SCROLL_TARGET}>
        {view === "list" ? (
          <div className="mt-6 text-sm">
            <SortHeader
              sort={sort}
              direction={direction}
              grouped={grouped}
              withCollection={signedIn}
              onSort={(column) => filters.sortBy(column)}
            />
            {decks.length === 0 ? (
              emptyState("py-10")
            ) : (
              <DeckList
                key={listKey}
                decks={decks}
                summaries={summaries}
                costs={costs}
                marketplace={marketplace}
                grouped={grouped}
                withCollection={signedIn}
              />
            )}
          </div>
        ) : decks.length === 0 ? (
          emptyState("mt-6")
        ) : (
          <div className="mt-6">
            <DeckGrid
              key={listKey}
              decks={decks}
              summaries={summaries}
              costs={costs}
              marketplace={marketplace}
              grouped={grouped}
            />
          </div>
        )}

        {(total > 0 || filters.perPage !== DEFAULT_DECK_PAGE_SIZE) && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Pager
              page={filters.page}
              totalPages={metaPageCount(total, filters.perPage)}
              onPageChange={handlePageChange}
              label={m.meta_browser_pages_aria()}
              scrollTargetId={DECK_LIST_ID}
            />
            <MetaPageSizePicker
              value={filters.perPage as MetaPageSizeValue}
              isDefault={filters.perPage === DEFAULT_DECK_PAGE_SIZE}
              total={total}
              itemLabel={(size) => m.meta_browser_per_page({ size })}
              ariaLabel={m.meta_browser_per_page_aria()}
              onChange={handlePerPageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
  size,
}: {
  view: MetaDeckView;
  onChange: (view: MetaDeckView) => void;
  size: ControlSize;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size={size}
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
  withCollection,
  onChange,
  size,
  className,
}: {
  sort: MetaDeckSort;
  direction: MetaDeckSortDirection;
  withCollection: boolean;
  onChange: (sort: MetaDeckSort, direction: MetaDeckSortDirection) => void;
  size: ControlSize;
  className?: string;
}) {
  const items: Record<string, string> = {};
  const presets = metaDeckSortPresets(withCollection);
  for (const preset of presets) {
    items[presetKey(preset.sort, preset.direction)] = preset.label;
  }
  const current = presetKey(sort, direction);
  const value = current in items ? current : presetKey("date", "desc");
  return (
    <SimpleSelect
      items={Object.entries(items).map(([itemValue, label]) => ({ value: itemValue, label }))}
      value={value}
      onChange={(next) => {
        const preset = presets.find((entry) => presetKey(entry.sort, entry.direction) === next);
        if (preset !== undefined) {
          onChange(preset.sort, preset.direction);
        }
      }}
      label={m.meta_browser_sort()}
      size={size}
      className={cn("w-48", className)}
    />
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
  grouped,
  withCollection,
  onSort,
}: {
  sort: MetaDeckSort;
  direction: MetaDeckSortDirection;
  grouped: boolean;
  withCollection: boolean;
  onSort: (column: MetaDeckSort) => void;
}) {
  return (
    <IndexSortHeader grid={deckIndexGrid(grouped, withCollection)}>
      <SortButton column="finish" sort={sort} direction={direction} onSort={onSort}>
        {m.meta_filter_finish()}
      </SortButton>
      <span />
      <span>{m.meta_standings_col_legend()}</span>
      <span>{m.meta_standings_col_player()}</span>
      {!grouped && (
        <>
          <span>{m.meta_finishes_col_event()}</span>
          <SortButton column="date" sort={sort} direction={direction} onSort={onSort}>
            {m.meta_col_date()}
          </SortButton>
        </>
      )}
      <SortButton column="value" sort={sort} direction={direction} onSort={onSort} align="end">
        {m.meta_standings_col_value()}
      </SortButton>
      {withCollection && (
        <SortButton column="cost" sort={sort} direction={direction} onSort={onSort}>
          {m.meta_cost_to_complete()}
        </SortButton>
      )}
    </IndexSortHeader>
  );
}

interface DeckListProps {
  decks: MetaDeckSummary[];
  summaries: ReadonlyMap<string, MetaEventSummary>;
  costs?: ReadonlyMap<string, MetaDeckCost>;
  marketplace: Marketplace;
  grouped: boolean;
  withCollection?: boolean;
}

function fieldSizeOf(summary: MetaEventSummary | undefined): number | null {
  return summary === undefined ? null : metaEventFieldSize(summary);
}

function DeckEventHeader({
  event,
  summary,
}: {
  event: MetaDeckSummary["event"];
  summary: MetaEventSummary | undefined;
}) {
  return (
    <RowListLink
      render={<Link to="/meta/$slug" params={{ slug: event.slug }} />}
      className="block py-2"
    >
      {summary === undefined ? (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{event.name}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatDay(event.eventDate)}
          </span>
        </span>
      ) : (
        <MetaEventHeading event={summary} showTier />
      )}
    </RowListLink>
  );
}

function DeckList({
  decks,
  summaries,
  costs,
  marketplace,
  grouped,
  withCollection,
}: DeckListProps) {
  const rows = (entries: readonly MetaDeckSummary[]) => (
    <RowList className="flex flex-col">
      {entries.map((deck) => (
        <li key={deck.deckId}>
          <MetaDeckIndexRow
            deck={deck}
            cost={costs?.get(deck.deckId)}
            fieldSize={fieldSizeOf(summaries.get(deck.event.slug))}
            marketplace={marketplace}
            grouped={grouped}
            withCollection={withCollection}
          />
        </li>
      ))}
    </RowList>
  );

  if (!grouped) {
    return rows(decks);
  }
  return (
    <div className="flex flex-col gap-4">
      {groupDecksByEvent(decks).map((group) => (
        <section key={group.event.slug} className="flex flex-col">
          <DeckEventHeader event={group.event} summary={summaries.get(group.event.slug)} />
          {rows(group.decks)}
        </section>
      ))}
    </div>
  );
}

function DeckGrid({ decks, summaries, costs, marketplace, grouped }: DeckListProps) {
  const tiles = (entries: readonly MetaDeckSummary[]) => (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map((deck) => (
        <li key={deck.deckId}>
          <MetaArchiveDeckTile
            deck={deck}
            cost={costs?.get(deck.deckId)}
            fieldSize={
              grouped ? undefined : (fieldSizeOf(summaries.get(deck.event.slug)) ?? undefined)
            }
            marketplace={marketplace}
            showEvent={!grouped}
          />
        </li>
      ))}
    </ul>
  );

  if (!grouped) {
    return tiles(decks);
  }
  return (
    <div className="flex flex-col gap-6">
      {groupDecksByEvent(decks).map((group) => (
        <section key={group.event.slug} className="flex flex-col gap-2">
          <DeckEventHeader event={group.event} summary={summaries.get(group.event.slug)} />
          {tiles(group.decks)}
        </section>
      ))}
    </div>
  );
}

export function MetaDeckBrowserPage() {
  const hydrated = useHydrated();
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);
  const signIn = useSignInSearch();
  const [count, setCount] = useState<DeckCount>();
  const onCount = (next: DeckCount) => {
    setCount((prev) =>
      prev?.matched === next.matched &&
      prev.archive === next.archive &&
      prev.events === next.events &&
      prev.onPage === next.onPage
        ? prev
        : next,
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarBack to="/meta" aria-label={m.meta_back_to_archive_aria()} />
          <PageTopBarTitle>{m.meta_browser_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "px-safe pt-3 pb-6")}>
        {signedIn && (
          <PageDescription className="pb-4">{m.meta_decks_page_description()}</PageDescription>
        )}
        <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p className="text-muted-foreground min-h-lh tabular-nums">
            {count === undefined
              ? null
              : count.onPage === null
                ? `${metaShownLabel(count.matched, count.archive, "decks")} · ${m.meta_count_events({ count: count.events })}`
                : m.meta_shown_decks_page({ shown: count.onPage })}
          </p>
          {!signedIn && (
            <Link
              rel="nofollow"
              {...signIn}
              className={buttonVariants({
                variant: "outline",
                size: "xs",
                className: "sm:ml-auto",
              })}
            >
              <LogInIcon />
              {m.decks_overview_hero_sign_in()}
            </Link>
          )}
        </div>

        {hydrated ? (
          <Suspense fallback={<MetaDeckBrowserFallback />}>
            <MetaDeckBrowser signedIn={signedIn} onCount={onCount} />
          </Suspense>
        ) : (
          <MetaDeckBrowserFallback />
        )}
      </div>
    </div>
  );
}
