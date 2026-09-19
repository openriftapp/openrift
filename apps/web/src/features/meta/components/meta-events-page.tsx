import type { MetaEventSummary } from "@openrift/shared/types/api/meta";
import { getRouteApi } from "@tanstack/react-router";
import { TrophyIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import {
  PageTopBar,
  PageTopBarBack,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PAGER_SCROLL_TARGET, Pager } from "@/components/ui/pager";
import { RowList } from "@/components/ui/row-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterDropdownChip } from "@/features/cards/components/compact-filter-bar";
import { SearchInput } from "@/features/cards/components/search-input";
import { useSearchUrlSync } from "@/features/cards/hooks/use-search-url-sync";
import {
  EVENT_INDEX_GRID,
  MetaEventIndexRow,
} from "@/features/meta/components/meta-event-index-row";
import { IndexSortButton } from "@/features/meta/components/meta-index-sort-button";
import { MetaScopeBar, ScopeSelect } from "@/features/meta/components/meta-scope-bar";
import {
  useMetaCounts,
  useMetaEventDayCounts,
  useMetaEventFacets,
  useMetaEventPage,
} from "@/features/meta/hooks/use-meta";
import { useMetaEras } from "@/features/meta/hooks/use-meta-eras";
import {
  facetCountsFrom,
  facetPresenceFrom,
  holdingsCountsFrom,
  metaEventCountries,
  nextEventSort,
} from "@/features/meta/lib/meta-events-index";
import type {
  MetaEventHoldings,
  MetaEventIndexSort,
  MetaEventIndexSortDirection,
} from "@/features/meta/lib/meta-events-search";
import {
  DEFAULT_EVENT_PAGE_SIZE,
  eventPageOrder,
  eventPageSlice,
  META_EVENT_HOLDINGS,
} from "@/features/meta/lib/meta-events-search";
import { metaShownLabel } from "@/features/meta/lib/meta-format";
import { META_PAGE_SIZES, metaPageCount } from "@/features/meta/lib/meta-paging";
import type { MetaScope } from "@/features/meta/lib/meta-scope";
import {
  CLEARED_SCOPE,
  eraCounts,
  metaEventFilterQuery,
  metaScopeQueryFromScope,
  nextScopeSearch,
  scopeKey,
} from "@/features/meta/lib/meta-scope";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/meta_/events");

const ANY_HOLDINGS = "";

const EVENT_LIST_ID = "meta-event-list";

export function MetaEventsPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const eras = useMetaEras();
  const order = eventPageOrder(search);
  const sort = order.by;
  const direction = order.dir;
  const filters = metaEventFilterQuery(search, eras);
  const { data } = useMetaEventPage({ ...filters, ...order, ...eventPageSlice(search) });
  const { data: facets } = useMetaEventFacets(filters);
  const { data: counts } = useMetaCounts();

  // Every narrowing changes which events the pages hold, so it opens the first one.
  const setSearchParams = (patch: Record<string, unknown>) => {
    void navigate({
      search: (prev) => nextScopeSearch({ ...prev, page: undefined }, patch),
      replace: true,
    });
  };

  const setScope = (patch: Partial<MetaScope>) => setSearchParams(patch);
  const clearScope = () =>
    setSearchParams({
      ...CLEARED_SCOPE,
      q: undefined,
      holds: undefined,
      playersMin: undefined,
      playersMax: undefined,
    });
  const setSort = (column: MetaEventIndexSort) => {
    const next = nextEventSort({ sort, direction }, column);
    setSearchParams({ by: next.sort, dir: next.direction });
  };
  const commitQuery = (value: string) => setSearchParams({ q: value === "" ? undefined : value });

  const events = data.events;
  const matched = data.total;
  const perPage = search.per ?? DEFAULT_EVENT_PAGE_SIZE;
  const { from: _from, to: _to, ...facetQuery } = metaScopeQueryFromScope(search, eras);
  const { data: dayCounts } = useMetaEventDayCounts({
    ...facetQuery,
    q: search.q,
    holds: search.holds,
    playersMin: search.playersMin,
    playersMax: search.playersMax,
  });
  // `by` and `dir` are deliberately absent: a re-sort keeps the rows mounted,
  // and with them each thumbnail's record of the source that failed to load.
  const listKey = `${search.q ?? ""}|${search.holds ?? ""}|${search.playersMin ?? ""}|${search.playersMax ?? ""}|${scopeKey(search)}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarBack to="/meta" aria-label={m.meta_back_to_archive_aria()} />
          <PageTopBarTitle>{m.meta_events_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "px-safe pt-3 pb-6")}>
        {counts.totalEvents === 0 ? (
          <EmptyState
            className="py-12"
            icon={TrophyIcon}
            title={m.meta_events_empty_title()}
            description={m.meta_events_empty_description()}
          />
        ) : (
          <>
            <MetaScopeBar
              search={
                <EventSearchBox
                  urlValue={search.q ?? ""}
                  onCommit={commitQuery}
                  shown={metaShownLabel(matched, counts.totalEvents, "events")}
                />
              }
              scope={search}
              setScope={setScope}
              clearScope={clearScope}
              eras={eras}
              countries={metaEventCountries(
                facets.countries.map((entry) => entry.value),
                search,
              )}
              facetCounts={facetCountsFrom(facets)}
              present={facetPresenceFrom(facets)}
              eraCounts={
                dayCounts === undefined ? undefined : eraCounts(dayCounts.days, eras, search)
              }
              extras={
                <>
                  <HoldingsChip
                    value={search.holds}
                    counts={holdingsCountsFrom(facets)}
                    onChange={(holds) => setSearchParams({ holds })}
                  />
                  <PlayersChip
                    min={search.playersMin}
                    max={search.playersMax}
                    onChange={(patch) => setSearchParams(patch)}
                  />
                </>
              }
              extrasActive={
                search.holds !== undefined ||
                search.playersMin !== undefined ||
                search.playersMax !== undefined
              }
              activeChips={[
                ...(search.holds === undefined
                  ? []
                  : [
                      {
                        key: "holds",
                        label: holdingsItems()[search.holds],
                        onRemove: () => setSearchParams({ holds: undefined }),
                      },
                    ]),
                ...(search.playersMin === undefined && search.playersMax === undefined
                  ? []
                  : [
                      {
                        key: "players",
                        label: playersSummary(search.playersMin, search.playersMax),
                        onRemove: () =>
                          setSearchParams({ playersMin: undefined, playersMax: undefined }),
                      },
                    ]),
              ]}
            />

            <div className={cn("mt-4 text-sm", PAGER_SCROLL_TARGET)} id={EVENT_LIST_ID}>
              <SortHeader sort={sort} direction={direction} onSort={setSort} />
              {events.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyDescription>
                      {matched === 0 ? m.meta_events_no_match() : m.meta_page_past_end()}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <EventList key={listKey} events={events} />
              )}
              {(matched > 0 || search.per !== undefined) && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  <Pager
                    page={search.page ?? 1}
                    totalPages={metaPageCount(matched, perPage)}
                    onPageChange={(next) =>
                      void navigate({
                        search: (prev) => ({ ...prev, page: next === 1 ? undefined : next }),
                        resetScroll: false,
                      })
                    }
                    label={m.meta_events_pages_aria()}
                    scrollTargetId={EVENT_LIST_ID}
                  />
                  <EventPageSizePicker
                    value={perPage}
                    total={matched}
                    onChange={(per) =>
                      setSearchParams({ per: per === DEFAULT_EVENT_PAGE_SIZE ? undefined : per })
                    }
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function holdingsItems(): Record<MetaEventHoldings | typeof ANY_HOLDINGS, string> {
  return {
    [ANY_HOLDINGS]: m.meta_events_holdings_any(),
    decks: m.meta_events_holdings_decks(),
    standings: m.meta_events_holdings_standings(),
    upcoming: m.meta_event_status_upcoming(),
    resultless: m.meta_events_holdings_resultless(),
  };
}

function HoldingsChip({
  value,
  counts,
  onChange,
}: {
  value: MetaEventHoldings | undefined;
  counts: Map<MetaEventHoldings | "", number>;
  onChange: (value: MetaEventHoldings | undefined) => void;
}) {
  return (
    <ScopeSelect
      label={m.meta_events_holdings_aria()}
      value={value ?? ANY_HOLDINGS}
      fallback={ANY_HOLDINGS}
      items={holdingsItems()}
      counts={counts}
      onValueChange={(next) => onChange(META_EVENT_HOLDINGS.find((entry) => entry === next))}
    />
  );
}

const PLAYER_PRESETS = [8, 16, 32, 64] as const;

function PlayersChip({
  min,
  max,
  onChange,
}: {
  min: number | undefined;
  max: number | undefined;
  onChange: (patch: { playersMin?: number; playersMax?: number }) => void;
}) {
  const active = min !== undefined || max !== undefined;
  const bound = (key: "playersMin" | "playersMax", value: number | undefined) => (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      className="h-8 w-20"
      placeholder={key === "playersMin" ? m.meta_events_players_min() : m.meta_events_players_max()}
      aria-label={
        key === "playersMin" ? m.meta_events_players_min_aria() : m.meta_events_players_max_aria()
      }
      value={value ?? ""}
      onChange={(event) => {
        const parsed =
          event.target.value === "" ? Number.NaN : Math.trunc(Number(event.target.value));
        onChange({ [key]: Number.isNaN(parsed) ? undefined : Math.max(0, parsed) });
      }}
    />
  );
  return (
    <FilterDropdownChip
      label={m.meta_events_players_label()}
      activeCount={active ? 1 : 0}
      summary={active ? playersSummary(min, max) : undefined}
      contentClassName="w-72"
    >
      <div className="flex items-center justify-between px-1.5">
        <span>{m.meta_events_players_label()}</span>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onChange({ playersMin: undefined, playersMax: undefined })}
          >
            {m.common_clear()}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 px-1.5">
        {bound("playersMin", min)}
        <span className="text-muted-foreground">–</span>
        {bound("playersMax", max)}
      </div>
      <div className="flex flex-wrap gap-1 px-1.5">
        {PLAYER_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="control"
            size="xs"
            aria-pressed={min === preset && max === undefined}
            onClick={() => onChange({ playersMin: preset, playersMax: undefined })}
          >
            {preset}+
          </Button>
        ))}
      </div>
    </FilterDropdownChip>
  );
}

function playersSummary(min: number | undefined, max: number | undefined): string {
  const label = m.meta_events_players_label();
  if (min !== undefined && max !== undefined) {
    return `${label} ${min} – ${max}`;
  }
  if (min !== undefined) {
    return `${label} ${min}+`;
  }
  return `${label} ≤ ${max}`;
}

function EventSearchBox({
  urlValue,
  onCommit,
  shown,
}: {
  urlValue: string;
  onCommit: (value: string) => void;
  shown: string;
}) {
  const [value, setValue] = useSearchUrlSync({ urlValue, onCommit });
  return (
    <SearchInput
      value={value}
      onValueChange={setValue}
      placeholder={m.meta_events_search_placeholder()}
      trailing={shown}
    />
  );
}

function EventList({ events }: { events: MetaEventSummary[] }) {
  return (
    <RowList className="flex flex-col">
      {events.map((event) => (
        <li key={event.id}>
          <MetaEventIndexRow event={event} />
        </li>
      ))}
    </RowList>
  );
}

function EventPageSizePicker({
  value,
  total,
  onChange,
}: {
  value: number;
  total: number;
  onChange: (value: number) => void;
}) {
  if (total <= META_PAGE_SIZES[0] && value === DEFAULT_EVENT_PAGE_SIZE) {
    return null;
  }
  const items = Object.fromEntries(META_PAGE_SIZES.map((size) => [String(size), String(size)]));
  return (
    <Select
      value={String(value)}
      items={items}
      onValueChange={(next) => onChange(Number((next as string | null) ?? DEFAULT_EVENT_PAGE_SIZE))}
    >
      <SelectTrigger className="w-36" aria-label={m.meta_events_per_page_aria()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {m.meta_events_per_page({ size: label })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortHeader({
  sort,
  direction,
  onSort,
}: {
  sort: MetaEventIndexSort;
  direction: MetaEventIndexSortDirection;
  onSort: (column: MetaEventIndexSort) => void;
}) {
  return (
    <div
      className={cn(
        EVENT_INDEX_GRID,
        "border-border text-muted-foreground -mx-2 hidden border-b px-2 py-2 text-xs font-semibold sm:grid",
      )}
    >
      <SortButton column="date" sort={sort} direction={direction} onSort={onSort}>
        {m.meta_col_date()}
      </SortButton>
      <SortButton column="name" sort={sort} direction={direction} onSort={onSort}>
        {m.meta_finishes_col_event()}
      </SortButton>
      <SortButton column="tier" sort={sort} direction={direction} onSort={onSort}>
        {m.meta_finishes_col_tier()}
      </SortButton>
      <SortButton column="country" sort={sort} direction={direction} onSort={onSort}>
        {m.meta_scope_country()}
      </SortButton>
      <SortButton column="players" sort={sort} direction={direction} onSort={onSort} align="end">
        {m.meta_events_col_players()}
      </SortButton>
      <SortButton column="decks" sort={sort} direction={direction} onSort={onSort} align="end">
        {m.meta_events_col_decks()}
      </SortButton>
      <span>{m.meta_events_winner()}</span>
    </div>
  );
}

const SortButton = IndexSortButton<MetaEventIndexSort>;
