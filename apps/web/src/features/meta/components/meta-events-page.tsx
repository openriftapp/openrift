import type { MetaEventSummary } from "@openrift/shared/types/api/meta";
import { getRouteApi } from "@tanstack/react-router";
import { TrophyIcon } from "lucide-react";
import { useState } from "react";

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
import { RowList } from "@/components/ui/row-list";
import { FilterDropdownChip } from "@/features/cards/components/compact-filter-bar";
import { SearchInput } from "@/features/cards/components/search-input";
import { useSearchUrlSync } from "@/features/cards/hooks/use-search-url-sync";
import {
  EVENT_INDEX_GRID,
  MetaEventIndexRow,
} from "@/features/meta/components/meta-event-index-row";
import { IndexSortButton } from "@/features/meta/components/meta-index-sort-button";
import { MetaScopeBar, ScopeSelect } from "@/features/meta/components/meta-scope-bar";
import { MetaShowMore } from "@/features/meta/components/meta-show-more";
import { useMetaCounts, useMetaEvents } from "@/features/meta/hooks/use-meta";
import { useMetaEras } from "@/features/meta/hooks/use-meta-eras";
import {
  filterMetaEvents,
  metaEventCountries,
  metaEventFacetCounts,
  metaEventHoldingsCounts,
  nextEventSort,
  sortMetaEvents,
} from "@/features/meta/lib/meta-events-index";
import type {
  MetaEventHoldings,
  MetaEventIndexSort,
  MetaEventIndexSortDirection,
} from "@/features/meta/lib/meta-events-search";
import {
  DEFAULT_EVENT_DIRECTION,
  DEFAULT_EVENT_SORT,
  META_EVENT_HOLDINGS,
} from "@/features/meta/lib/meta-events-search";
import { metaShownLabel } from "@/features/meta/lib/meta-format";
import type { MetaScope } from "@/features/meta/lib/meta-scope";
import {
  CLEARED_SCOPE,
  nextScopeSearch,
  resolveScopeRange,
  scopeKey,
} from "@/features/meta/lib/meta-scope";
import { scopeFacetPresence } from "@/features/meta/lib/meta-scope-match";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/meta_/events");

const PAGE_SIZE = 50;

const ANY_HOLDINGS = "";

export function MetaEventsPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const eras = useMetaEras();
  const { data } = useMetaEvents(resolveScopeRange(search, eras));
  const { data: counts } = useMetaCounts();

  const sort = search.by ?? DEFAULT_EVENT_SORT;
  const direction = search.dir ?? DEFAULT_EVENT_DIRECTION;

  const setSearchParams = (patch: Record<string, unknown>) => {
    void navigate({ search: (prev) => nextScopeSearch(prev, patch), replace: true });
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

  const fetched = data.events;
  const indexFilter = {
    query: search.q,
    scope: search,
    eras,
    holds: search.holds,
    playersMin: search.playersMin,
    playersMax: search.playersMax,
  };
  const events = sortMetaEvents(filterMetaEvents(fetched, indexFilter), sort, direction);
  const facetCounts = metaEventFacetCounts(fetched, indexFilter);
  const holdingsCounts = metaEventHoldingsCounts(fetched, indexFilter);
  const countries = metaEventCountries(fetched);
  // Sort keys are deliberately absent: reordering keeps the same rows expanded.
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
            <div className="flex flex-col gap-2">
              <EventSearchBox
                urlValue={search.q ?? ""}
                onCommit={commitQuery}
                shown={metaShownLabel(events.length, counts.totalEvents, "events")}
              />
              <MetaScopeBar
                scope={search}
                setScope={setScope}
                clearScope={clearScope}
                eras={eras}
                countries={countries}
                facetCounts={facetCounts}
                present={scopeFacetPresence(fetched)}
                extras={
                  <>
                    <HoldingsChip
                      value={search.holds}
                      counts={holdingsCounts}
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
              />
            </div>

            <div className="mt-4 text-sm">
              <SortHeader sort={sort} direction={direction} onSort={setSort} />
              {events.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyDescription>{m.meta_events_no_match()}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <EventList key={listKey} events={events} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function holdingsItems(): Record<string, string> {
  return {
    [ANY_HOLDINGS]: m.meta_events_holdings_any(),
    decks: m.meta_events_holdings_decks(),
    standings: m.meta_events_holdings_standings(),
    upcoming: m.meta_event_status_upcoming(),
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
  const [shown, setShown] = useState(PAGE_SIZE);
  const remaining = events.length - shown;

  return (
    <>
      <RowList className="flex flex-col">
        {events.slice(0, shown).map((event) => (
          <li key={event.id}>
            <MetaEventIndexRow event={event} />
          </li>
        ))}
      </RowList>
      {remaining > 0 && (
        <MetaShowMore onClick={() => setShown(shown + PAGE_SIZE)}>
          {remaining.toLocaleString()} more {remaining === 1 ? "event" : "events"}
        </MetaShowMore>
      )}
    </>
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
