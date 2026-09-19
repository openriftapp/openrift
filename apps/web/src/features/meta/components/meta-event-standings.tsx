import { STANDINGS_PAGE_SIZE } from "@openrift/shared/contracts/meta";
import { cutSizeOf } from "@openrift/shared/meta-standings";
import { todayUtc } from "@openrift/shared/set-release";
import type {
  MetaEventField,
  MetaEventPhase,
  MetaEventStandingsResponse,
} from "@openrift/shared/types/api/meta";
import type { MetaEventStatus } from "@openrift/shared/types/enums";
import { getRouteApi } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PAGER_SCROLL_TARGET, Pager } from "@/components/ui/pager";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CardDetailOverlayProvider } from "@/features/cards/components/card-detail-opener";
import { useSearchUrlSync } from "@/features/cards/hooks/use-search-url-sync";
import type { MetaCostFilterValue } from "@/features/meta/components/meta-deck-cost-filter";
import {
  EMPTY_META_COST_FILTER,
  MetaDeckCostFilter,
} from "@/features/meta/components/meta-deck-cost-filter";
import { MetaDeckCostsBridge } from "@/features/meta/components/meta-deck-costs-bridge";
import {
  DesktopStandings,
  PhoneStandings,
} from "@/features/meta/components/meta-event-standings-body";
import { useMetaStandings } from "@/features/meta/hooks/use-meta";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import {
  ANY_LEGEND,
  legendOptions,
  standingsColumns,
  subtitleFor,
} from "@/features/meta/lib/meta-event-standings";
import { describeEventProgress } from "@/features/meta/lib/meta-event-structure";
import type { MetaPageSize } from "@/features/meta/lib/meta-paging";
import { META_PAGE_ALL, META_PAGE_SIZES, metaPageCount } from "@/features/meta/lib/meta-paging";
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
import { useUserId } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/meta_/$slug");

const STANDINGS_ID = "meta-standings";

function emptyStandingsCopy(status: MetaEventStatus, eventDate: string): string {
  if (status === "in_progress") {
    return m.meta_standings_in_progress();
  }
  if (status === "upcoming" || eventDate > todayUtc()) {
    return m.meta_standings_upcoming();
  }
  return m.meta_standings_none();
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
  phases,
  slug,
  eventDate,
  status,
  pending,
}: {
  firstPage: MetaEventStandingsResponse;
  field: MetaEventField;
  phases: readonly MetaEventPhase[];
  slug: string;
  pending: ReadonlyMap<string, MetaPendingRowMark>;
  /** UTC date. */
  eventDate: string;
  status: MetaEventStatus;
}) {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const canSubmit = useUserId() !== null;
  const hydrated = useHydrated();
  const [costs, setCosts] = useState<ReadonlyMap<string, MetaDeckCost>>();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // The Value column prices the sideboard in, so the filter has to price it in too.
  const [costFilter, setCostFilter] = useState<MetaCostFilterValue>({
    ...EMPTY_META_COST_FILTER,
    includeSideboard: true,
  });
  // Clearing the cost filter undoes a `list=with` this component set and leaves
  // one the reader chose in place.
  const [narrowedToLists, setNarrowedToLists] = useState(false);

  const setView = (patch: Partial<MetaStandingsSearch>) => {
    void navigate({
      // A narrowing changes which entries the pages hold, so it opens the first one.
      search: (prev) => ({ ...prev, page: undefined, ...patch }),
      replace: true,
    });
  };

  const costActive = costs !== undefined && isCostFilterActive(costFilter);
  const narrowToLists = () => {
    if (search.list !== "with") {
      setNarrowedToLists(true);
      setView({ list: "with" });
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

  if (firstPage.total === 0) {
    return (
      <section className="mt-8">
        <Heading className="mb-3">{m.meta_standings_heading()}</Heading>
        <Empty>
          <EmptyHeader>
            <EmptyDescription>{emptyStandingsCopy(status, eventDate)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  const columns = standingsColumns(field, canSubmit || pending.size > 0);
  const legends = legendOptions(field.legends);
  const players = isError ? [] : page.players;
  const matching = costActive
    ? players.filter((player) =>
        costMatchesBounds(
          player.deckId === null ? undefined : costs?.get(player.deckId),
          costFilter,
        ),
      )
    : players;
  const showSearch = firstPage.total > 8;
  const showLegendFilter = showSearch && Object.keys(legends).length > 0;
  const totalPages = metaPageCount(page.total, shown.perPage);
  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id);
  const body = {
    cutSize: cutSizeOf(phases),
    players: matching,
    slug,
    canSubmit,
    columns,
    costs,
    pending,
    expandedId,
    onToggle: toggle,
  };

  return (
    <CardDetailOverlayProvider>
      <section className="mt-8">
        {hydrated && columns.value && (
          <Suspense fallback={null}>
            <MetaDeckCostsBridge
              includeSideboard={costFilter.includeSideboard}
              withCollection={canSubmit}
              decks={{ event: slug }}
              onChange={setCosts}
            />
          </Suspense>
        )}

        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Heading>{m.meta_standings_heading()}</Heading>
          <p className="text-muted-foreground text-sm">
            {subtitleFor(firstPage.total, field.withLists)}
          </p>
          {status === "in_progress" && (
            <p className="text-foreground text-sm font-medium">
              {[describeEventProgress(field.progress, phases), "provisional"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        {(field.withLists > 0 || showSearch || showLegendFilter) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {field.withLists > 0 && (
              <ToggleGroup
                variant="outline"
                spacing={0}
                value={[search.list === "with" ? "withList" : "all"]}
                onValueChange={([next]) => {
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
            {showSearch && (
              <StandingsSearch
                value={search.q ?? ""}
                onCommit={(next) => setView({ q: next === "" ? undefined : next })}
              />
            )}
            {showLegendFilter && (
              <Select
                value={search.legend ?? ANY_LEGEND}
                onValueChange={(value) => {
                  const picked = (value as string | null) ?? ANY_LEGEND;
                  setView({ legend: picked === ANY_LEGEND ? undefined : picked });
                }}
                items={legends}
              >
                <SelectTrigger className="w-56" aria-label={m.meta_standings_filter_legend()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(legends).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {columns.value && (
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
            aria-busy={isPlaceholderData}
            className={cn(
              "transition-opacity duration-150",
              isPlaceholderData ? "opacity-60" : "opacity-100",
            )}
          >
            {isError ? (
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
              </>
            )}
          </div>
          {(page.total > 0 || search.per !== undefined) && (
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
              <PageSizePicker
                value={(search.per as MetaPageSize | undefined) ?? null}
                total={page.total}
                onChange={(per) => setView({ per: per === STANDINGS_PAGE_SIZE ? undefined : per })}
              />
            </div>
          )}
        </div>
      </section>
    </CardDetailOverlayProvider>
  );
}

function PageSizePicker({
  value,
  total,
  onChange,
}: {
  value: MetaPageSize | null;
  total: number;
  onChange: (value: MetaPageSize | undefined) => void;
}) {
  const items: Record<string, string> = {
    ...Object.fromEntries(META_PAGE_SIZES.map((size) => [String(size), String(size)])),
    [META_PAGE_ALL]: m.meta_standings_per_all(),
  };

  if (total <= META_PAGE_SIZES[0] && value === null) {
    return null;
  }
  return (
    <Select
      value={String(value ?? STANDINGS_PAGE_SIZE)}
      items={items}
      onValueChange={(next) => {
        const picked = (next as string | null) ?? String(STANDINGS_PAGE_SIZE);
        onChange(picked === META_PAGE_ALL ? META_PAGE_ALL : (Number(picked) as MetaPageSize));
      }}
    >
      <SelectTrigger className="w-36" aria-label={m.meta_standings_per_page_aria()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {m.meta_standings_per_page({ size: label })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StandingsSearch({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [typed, setTyped] = useSearchUrlSync({ urlValue: value, onCommit });

  return (
    <div className="relative min-w-48 flex-1 sm:max-w-64">
      <SearchIcon
        aria-hidden
        className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
      />
      <Input
        type="search"
        aria-label={m.meta_standings_find_player()}
        placeholder={m.meta_standings_find_player_placeholder()}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="pl-8"
      />
    </div>
  );
}
