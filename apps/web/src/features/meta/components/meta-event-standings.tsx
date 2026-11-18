import { todayUtc } from "@openrift/shared/format-date";
import { STANDINGS_PAGE_SIZE } from "@openrift/shared/meta-query";
import { metaResultsState } from "@openrift/shared/meta-results";
import { cutSizeOf } from "@openrift/shared/meta-standings";
import type {
  MetaEventField,
  MetaEventPhase,
  MetaEventStandingsResponse,
  MetaStandingsRow,
} from "@openrift/shared/types/api/meta";
import type { MetaEventStatus } from "@openrift/shared/types/enums";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { PAGER_SCROLL_TARGET, Pager } from "@/components/ui/pager";
import { SimpleSelect } from "@/components/ui/simple-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CardDetailOverlayProvider } from "@/features/cards/components/card-detail-opener";
import type { MetaCostFilterValue } from "@/features/meta/components/meta-deck-cost-filter";
import {
  EMPTY_META_COST_FILTER,
  MetaDeckCostFilter,
} from "@/features/meta/components/meta-deck-cost-filter";
import {
  DesktopStandings,
  PhoneStandings,
} from "@/features/meta/components/meta-event-standings-body";
import { MetaEventStandingsByLegend } from "@/features/meta/components/meta-event-standings-by-legend";
import { MetaListShapeKey } from "@/features/meta/components/meta-list-shape-bar";
import { MetaPageSizePicker } from "@/features/meta/components/meta-page-size-picker";
import { useMetaLegendGroupRows, useMetaStandings } from "@/features/meta/hooks/use-meta";
import { useMetaDeckBans } from "@/features/meta/hooks/use-meta-deck-bans";
import { useMetaDeckCosts } from "@/features/meta/hooks/use-meta-deck-costs";
import { partialListDeckIds } from "@/features/meta/lib/meta-deck-collection";
import {
  ANY_LEGEND,
  legendOptions,
  standingsColumns,
  subtitleFor,
} from "@/features/meta/lib/meta-event-standings";
import { describeEventProgress } from "@/features/meta/lib/meta-event-structure";
import {
  LEGEND_GROUP_ROWS,
  LEGEND_GROUPS_SHOWN,
  legendGroups,
  openLegendIds,
  unknownLegendGroup,
} from "@/features/meta/lib/meta-legend-groups";
import type { MetaPageSize } from "@/features/meta/lib/meta-paging";
import { metaPageCount } from "@/features/meta/lib/meta-paging";
import type { MetaPendingRowMark } from "@/features/meta/lib/meta-pending-submissions";
import {
  costMatchesBounds,
  countStandingsUnderCost,
  highestStandingsCost,
  isCostFilterActive,
} from "@/features/meta/lib/meta-standings-cost";
import type { MetaStandingsSearch } from "@/features/meta/lib/meta-standings-search";
import { standingsPageQuery, standingsPageSize } from "@/features/meta/lib/meta-standings-search";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSearchUrlSync } from "@/hooks/use-search-url-sync";
import { useUserId } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/meta_/$slug");

const STANDINGS_ID = "meta-standings";

function emptyStandingsCopy(recordedStatus: MetaEventStatus, eventDate: string): string {
  const state = metaResultsState({ recordedStatus, eventDate, playerRowCount: 0 }, todayUtc());
  if (state === "notStarted") {
    return m.meta_standings_upcoming();
  }
  return state === "collecting" ? m.meta_standings_in_progress() : m.meta_event_no_results();
}

/** A cost bound narrows the page on screen, so an emptied page is not an emptied field. */
function narrowedEmptyCopy(costActive: boolean, total: number): string {
  if (costActive) {
    return m.meta_standings_cost_none_on_page();
  }
  return total > 0 ? m.meta_page_past_end() : m.meta_standings_no_entries();
}

/**
 * Every narrowing but cost lives in the URL and is a request. Cost is priced in
 * the browser, so it narrows the page on screen and asks the API for the entries holding a decklist.
 */
export function MetaEventStandings({
  firstPage,
  field,
  bestPerLegend,
  phases,
  slug,
  eventDate,
  recordedStatus,
  pending,
}: {
  firstPage: MetaEventStandingsResponse;
  field: MetaEventField;
  bestPerLegend: readonly MetaStandingsRow[];
  phases: readonly MetaEventPhase[];
  slug: string;
  pending: ReadonlyMap<string, MetaPendingRowMark>;
  /** UTC date. */
  eventDate: string;
  recordedStatus: MetaEventStatus;
}) {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const canSubmit = useUserId() !== null;
  const hydrated = useHydrated();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // The Value column prices the sideboard in, so the filter has to price it in too.
  const [costFilter, setCostFilter] = useState<MetaCostFilterValue>({
    ...EMPTY_META_COST_FILTER,
    includeSideboard: true,
  });
  // Clearing the cost filter undoes a `list=with` this component set and leaves
  // one the reader chose in place.
  const [narrowedToLists, setNarrowedToLists] = useState(false);
  const [touchedLegends, setTouchedLegends] = useState<readonly string[] | null>(null);
  const [allLegendsShown, setAllLegendsShown] = useState(false);

  const setView = (patch: Partial<MetaStandingsSearch>, replace = false) => {
    void navigate({
      // A narrowing changes which entries the pages hold, so it opens the first one.
      search: (prev) => ({ ...prev, page: undefined, ...patch }),
      replace,
    });
  };

  const narrowToLists = () => {
    if (search.list !== "with") {
      setNarrowedToLists(true);
      setView({ list: "with" }, true);
    }
  };
  const { data, isError, isPlaceholderData, refetch } = useMetaStandings(
    slug,
    standingsPageQuery(search, firstPage.total),
  );
  // `keepPreviousData` holds a page only while the query is pending, so a rejection empties `data`.
  const page = data ?? firstPage;
  const asked = { page: search.page ?? 1, perPage: standingsPageSize(search, firstPage.total) };
  const [shown, setShown] = useState(asked);
  if (!isPlaceholderData && (shown.page !== asked.page || shown.perPage !== asked.perPage)) {
    setShown(asked);
  }

  const unknownGroup = unknownLegendGroup(field.legends, firstPage.total);
  const legends = legendOptions(field.legends, unknownGroup?.count ?? 0);
  const showSearch = firstPage.total > 8;
  const showLegendFilter = showSearch && Object.keys(legends).length > 0;
  const byLegend = showLegendFilter && search.by === "legend";
  const groups = legendGroups(field.legends, bestPerLegend);
  const openIds = openLegendIds(touchedLegends, groups);
  const allGroupIds = [
    ...(allLegendsShown ? groups : groups.slice(0, LEGEND_GROUPS_SHOWN)).map(
      (group) => group.cardId,
    ),
    ...(unknownGroup === null ? [] : [unknownGroup.cardId]),
  ];
  const groupRows = useMetaLegendGroupRows(slug, byLegend ? openIds : [], LEGEND_GROUP_ROWS);
  const columns = standingsColumns(field, canSubmit || pending.size > 0);
  const players = isError ? [] : page.players;
  const costs = useMetaDeckCosts(costFilter.includeSideboard, {
    enabled: hydrated && columns.value,
    withCollection: canSubmit,
    decks: { event: slug },
    // The group rows go in as their own argument: merging them into one array
    // here stops the compiler memoizing this whole component.
    partialDeckIds: partialListDeckIds(players, groupRows.lists),
  });
  const bans = useMetaDeckBans({ event: slug }, hydrated && field.withLists > 0);
  const costActive = costs !== undefined && isCostFilterActive(costFilter);

  if (firstPage.total === 0) {
    return (
      <section className="mt-8">
        <Heading className="mb-3">{m.meta_standings_heading()}</Heading>
        <Empty>
          <EmptyHeader>
            <EmptyDescription>{emptyStandingsCopy(recordedStatus, eventDate)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  const matching = costActive
    ? players.filter((player) =>
        costMatchesBounds(
          player.deckId === null ? undefined : costs?.get(player.deckId),
          costFilter,
        ),
      )
    : players;
  const totalPages = metaPageCount(page.total, shown.perPage);
  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id);
  const groupBody = {
    cutSize: cutSizeOf(phases),
    slug,
    canSubmit,
    columns,
    costs,
    bans,
    eventDate,
    pending,
    expandedId,
    onToggle: toggle,
  };
  const body = { ...groupBody, players: matching };
  const dimmed = isPlaceholderData && !byLegend;

  return (
    <CardDetailOverlayProvider>
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Heading>{m.meta_standings_heading()}</Heading>
          <p className="text-muted-foreground text-sm">
            {subtitleFor(firstPage.total, field.withLists)}
          </p>
          {metaResultsState(
            { recordedStatus, eventDate, playerRowCount: firstPage.total },
            todayUtc(),
          ) === "collecting" && (
            <p className="text-foreground text-sm font-medium">
              {[describeEventProgress(field.progress, phases), m.meta_standings_provisional()]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        {(field.withLists > 0 || showSearch || showLegendFilter) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {showLegendFilter && (
              <ToggleGroup
                variant="outline"
                spacing={0}
                value={[byLegend ? "legend" : "rank"]}
                onValueChange={([next]) => {
                  // Pressing the active item again sends no value.
                  if (next === undefined) {
                    return;
                  }
                  setNarrowedToLists(false);
                  if (next === "rank") {
                    setView({ by: undefined });
                    return;
                  }
                  setCostFilter((current) => ({
                    ...current,
                    maxCost: null,
                    valueRange: { min: null, max: null },
                  }));
                  setView({ by: "legend", q: undefined, list: undefined, legend: undefined });
                }}
                aria-label={m.meta_standings_order_aria()}
              >
                <ToggleGroupItem value="rank">{m.meta_standings_by_rank()}</ToggleGroupItem>
                <ToggleGroupItem value="legend">{m.meta_standings_by_legend()}</ToggleGroupItem>
              </ToggleGroup>
            )}
            {byLegend && (
              <Button
                variant="link"
                className="ml-auto h-auto p-0 text-sm font-medium"
                onClick={() => setTouchedLegends(openIds.length > 0 ? [] : allGroupIds)}
              >
                {openIds.length > 0
                  ? m.meta_standings_collapse_all()
                  : m.meta_standings_expand_all()}
              </Button>
            )}
            {!byLegend && field.withLists > 0 && (
              <ToggleGroup
                variant="outline"
                spacing={0}
                value={[search.list === "with" ? "withList" : "all"]}
                onValueChange={([next]) => {
                  if (next === undefined) {
                    return;
                  }
                  setNarrowedToLists(false);
                  setView({ list: next === "withList" ? "with" : undefined });
                }}
                aria-label={m.meta_standings_which_entries()}
              >
                <ToggleGroupItem value="all">{m.meta_standings_all_entries()}</ToggleGroupItem>
                <ToggleGroupItem value="withList">
                  {m.meta_standings_with_decklist({ count: field.withLists })}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            {!byLegend && showSearch && (
              <StandingsSearch
                value={search.q ?? ""}
                onCommit={(next) => setView({ q: next === "" ? undefined : next }, true)}
              />
            )}
            {!byLegend && showLegendFilter && (
              <SimpleSelect
                items={Object.entries(legends).map(([value, label]) => ({ value, label }))}
                value={search.legend ?? ANY_LEGEND}
                onChange={(picked) =>
                  setView({ legend: picked === ANY_LEGEND ? undefined : picked })
                }
                label={m.meta_standings_filter_legend()}
                className="w-56"
              />
            )}
            {!byLegend && columns.value && (
              <MetaDeckCostFilter
                trigger="control"
                triggerSize="default"
                noun="list"
                ready={costs !== undefined}
                withCollection={canSubmit}
                countUnderCost={(maxCost) =>
                  countStandingsUnderCost(players, costs, costFilter, maxCost)
                }
                maxToComplete={highestStandingsCost(players, costs, (cost) => cost.toComplete)}
                maxValue={highestStandingsCost(players, costs, (cost) => cost.value)}
                value={costFilter}
                onMaxCostChange={(next) => {
                  setCostFilter((current) => ({ ...current, maxCost: next }));
                  // Cost only exists for an entry with a list, so asking for one narrows to those.
                  if (next !== null) {
                    narrowToLists();
                  }
                }}
                onValueRangeChange={(next) => {
                  setCostFilter((current) => ({ ...current, valueRange: next }));
                  if (next.min !== null || next.max !== null) {
                    narrowToLists();
                  }
                }}
                onIncludeSideboardChange={(next) =>
                  setCostFilter((current) => ({ ...current, includeSideboard: next }))
                }
                onClear={() => {
                  setCostFilter((current) => ({
                    ...current,
                    maxCost: null,
                    valueRange: { min: null, max: null },
                  }));
                  if (narrowedToLists) {
                    setNarrowedToLists(false);
                    setView({ list: undefined });
                  }
                }}
              />
            )}
          </div>
        )}

        <div id={STANDINGS_ID} className={PAGER_SCROLL_TARGET}>
          <div
            aria-busy={dimmed}
            className={cn("transition-opacity duration-150", dimmed ? "opacity-60" : "opacity-100")}
          >
            {byLegend ? (
              <MetaEventStandingsByLegend
                groups={groups}
                unknownGroup={unknownGroup}
                allShown={allLegendsShown}
                openIds={openIds}
                rowsByLegend={new Map(openIds.map((id, index) => [id, groupRows.groups[index]]))}
                onShowAll={() => setAllLegendsShown(!allLegendsShown)}
                body={{ ...groupBody, columns: { ...columns, legend: false } }}
                onToggleGroup={(cardId) =>
                  setTouchedLegends(
                    openIds.includes(cardId)
                      ? openIds.filter((id) => id !== cardId)
                      : [...openIds, cardId],
                  )
                }
                onSeeAll={(cardId) => setView({ by: undefined, legend: cardId })}
              />
            ) : isError ? (
              <Empty>
                <EmptyHeader>
                  <EmptyDescription>{m.common_error_generic()}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => void refetch()}>
                    {m.common_retry()}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : matching.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyDescription>{narrowedEmptyCopy(costActive, page.total)}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <DesktopStandings {...body} />
                <PhoneStandings {...body} />
                {matching.some((player) => player.listShape !== null) && (
                  <MetaListShapeKey className="px-3 py-2" />
                )}
              </>
            )}
          </div>
          {!byLegend && (page.total > 0 || search.per !== undefined) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <Pager
                page={shown.page}
                totalPages={totalPages}
                onPageChange={(next) =>
                  void navigate({
                    search: (prev) => ({ ...prev, page: next === 1 ? undefined : next }),
                    resetScroll: false,
                  })
                }
                label={m.meta_standings_pages_aria()}
                scrollTargetId={STANDINGS_ID}
              />
              <MetaPageSizePicker<MetaPageSize>
                value={(search.per as MetaPageSize | undefined) ?? STANDINGS_PAGE_SIZE}
                isDefault={search.per === undefined}
                total={page.total}
                allLabel={m.meta_standings_per_all()}
                itemLabel={(size) => m.meta_standings_per_page({ size })}
                ariaLabel={m.meta_standings_per_page_aria()}
                onChange={(per) =>
                  setView({ per: per === STANDINGS_PAGE_SIZE ? undefined : per }, true)
                }
              />
            </div>
          )}
        </div>
      </section>
    </CardDetailOverlayProvider>
  );
}

function StandingsSearch({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [typed, setTyped] = useSearchUrlSync({ urlValue: value, onCommit });

  return (
    <SearchInput
      className="min-w-48 flex-1 sm:max-w-64"
      aria-label={m.meta_standings_find_player()}
      placeholder={m.meta_standings_find_player_placeholder()}
      value={typed}
      onValueChange={setTyped}
    />
  );
}
