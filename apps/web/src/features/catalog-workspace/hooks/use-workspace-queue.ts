import type {
  WorkspaceOwner,
  WorkspaceRecordFilter,
  WorkspaceRecordRow,
  WorkspaceRecordsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { WORKSPACE_RECORD_FILTERS } from "@openrift/shared/contracts/admin/catalog-workspace";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardListWhen } from "@/features/admin/hooks/use-admin-card-queries";
import { filterDeskPrintings, sortDeskPrintings } from "@/features/admin/lib/printing-desk-filter";
import { deskPrintingsQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import type {
  DeskMode,
  DeskRow,
  ListEntry,
  OwnerGroup,
  WorkspaceRole,
} from "@/features/catalog-workspace/lib/owner-items";
import {
  cardSummaryEntry,
  cardSummaryKey,
  deskEntry,
  distinctProviders,
  filterCardSummaries,
  filterDeskRows,
  filterGroups,
  groupEntry,
  groupOwnerItems,
  groupsByKey,
  ownersForRole,
  queueStats,
  recordEntry,
  rowMatchesSource,
  segmentCounts,
  sortGroups,
  visibleQueueItems,
  workspaceRole,
} from "@/features/catalog-workspace/lib/owner-items";
import {
  workspaceQueueQueryOptions,
  workspaceRecordsInfiniteQueryOptions,
} from "@/features/catalog-workspace/lib/workspace-queries";
import type {
  WorkspaceSearch,
  WorkspaceView,
} from "@/features/catalog-workspace/lib/workspace-search";
import { workspaceSearchSchema } from "@/features/catalog-workspace/lib/workspace-search";
import { useWorkspaceSkipStore } from "@/features/catalog-workspace/stores/workspace-skip-store";
import { useScopeEffect } from "@/hooks/use-scope-effect";

const RECORDS_PAGE_SIZE = 500;

export const RECORD_FILTERS: Record<
  "face" | "printing" | "desk",
  readonly WorkspaceRecordFilter[]
> = {
  ...WORKSPACE_RECORD_FILTERS,
  desk: ["double-sided", "no-image"],
};

export function recordFilterFor(
  kind: "face" | "printing" | "desk",
  filter: WorkspaceRecordFilter | undefined,
): WorkspaceRecordFilter | undefined {
  return filter !== undefined && RECORD_FILTERS[kind].includes(filter) ? filter : undefined;
}

export function filterDeskTable(
  rows: readonly DeskRow[],
  search: Pick<WorkspaceSearchState, "q" | "status" | "deskSort" | "filter">,
): DeskRow[] {
  const filter = recordFilterFor("desk", search.filter);
  const matching = filterDeskPrintings(filterDeskRows(rows, search.q), {
    query: "",
    status: search.status ?? "any",
  }).filter(
    (row) =>
      (filter !== "double-sided" || row.secondSide !== null) &&
      (filter !== "no-image" || row.imageCount === 0),
  );
  return sortDeskPrintings(matching, search.deskSort ?? "updated");
}

const NO_SKIPS: string[] = [];

export interface WorkspaceSearchState extends WorkspaceSearch {
  desk?: DeskMode;
}

export function useWorkspaceRole(): WorkspaceRole {
  const { data } = useAdminAccess();
  return workspaceRole(data);
}

function useWorkspaceSearch(): WorkspaceSearchState {
  const raw: Record<string, unknown> = useSearch({ strict: false });
  const desk = raw.desk === "mine" || raw.desk === "promos" ? raw.desk : undefined;
  return { ...workspaceSearchSchema.parse(raw), desk };
}

export function resolveView(
  owner: WorkspaceOwner,
  role: WorkspaceRole,
  segment: WorkspaceView | undefined,
): WorkspaceView {
  if (role === "desk") {
    return "all";
  }
  if (segment === "new" && owner === "face") {
    return "open";
  }
  return segment ?? "open";
}

export function useWorkspaceQueue(owner: WorkspaceOwner) {
  const role = useWorkspaceRole();
  const search = useWorkspaceSearch();
  const view = resolveView(owner, role, search.segment);
  const query = useQuery({ ...workspaceQueueQueryOptions(), enabled: role !== "none" });
  const skipped = useWorkspaceSkipStore((state) => state.skipped[owner] ?? NO_SKIPS);
  const prune = useWorkspaceSkipStore((state) => state.prune);

  const items = query.data ? visibleQueueItems(query.data.items, role) : [];
  const ownerGroups = groupOwnerItems(items.filter((item) => item.owner === owner));
  useScopeEffect(query.data, (data) => {
    if (data !== undefined && role !== "none") {
      prune(owner, new Set(ownerGroups.map((group) => group.key)));
    }
  });
  const segmentGroups = view === "all" ? [] : ownerGroups.filter((group) => group.segment === view);
  const groups = sortGroups(filterGroups(segmentGroups, search), search.order ?? "oldest", skipped);

  return {
    role,
    search,
    view,
    isPending: query.isPending && role !== "none",
    error: query.error,
    items,
    groups,
    entries: groups.map((group) => groupEntry(group)),
    ownerGroups,
    counts: segmentCounts(ownerGroups),
    stats: queueStats(segmentGroups),
    providers: distinctProviders(view === "all" ? ownerGroups : segmentGroups),
    doneToday: query.data?.doneToday ?? 0,
  };
}

interface RecordsCommon {
  entries: ListEntry[];
  groups: ReadonlyMap<string, OwnerGroup>;
  source: Pick<WorkspaceSearch, "provider" | "reason">;
  query: { kind: "face" | "printing"; q?: string; filter?: WorkspaceRecordFilter };
  pages: readonly WorkspaceRecordsResponse[];
  total: number | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  isPending: boolean;
  error: Error | null;
}

const NO_MORE = { hasMore: false, isLoadingMore: false, loadMore: () => null };

export type WorkspaceRecordsResult =
  | (RecordsCommon & { kind: "card"; rows: ReturnType<typeof filterCardSummaries> })
  | (RecordsCommon & { kind: "desk"; rows: ReturnType<typeof filterDeskRows> })
  | (RecordsCommon & { kind: "face" | "printing"; rows: WorkspaceRecordRow[] });

export function useWorkspaceRecords(
  owner: WorkspaceOwner,
  enabled: boolean,
): WorkspaceRecordsResult {
  const role = useWorkspaceRole();
  const search = useWorkspaceSearch();
  const trimmed = search.q?.trim() ?? "";
  const q = trimmed === "" ? undefined : trimmed;
  const deskMode = search.desk ?? "mine";
  const isDesk = role === "desk" && owner === "printing";

  const recordKind = owner === "face" ? "face" : "printing";
  const query = {
    kind: recordKind,
    q,
    filter: recordFilterFor(recordKind, search.filter),
  } as const;

  const queue = useQuery({ ...workspaceQueueQueryOptions(), enabled: enabled && role !== "none" });
  const groups = groupsByKey(
    groupOwnerItems(
      visibleQueueItems(queue.data?.items ?? [], role).filter((item) => item.owner === owner),
    ),
  );
  const cards = useAdminCardListWhen(enabled && owner === "card");
  const records = useInfiniteQuery({
    ...workspaceRecordsInfiniteQueryOptions({ ...query, limit: RECORDS_PAGE_SIZE }),
    enabled: enabled && owner !== "card" && !isDesk,
  });
  const desk = useQuery({
    ...deskPrintingsQueryOptions(deskMode === "promos" ? "all" : "mine"),
    enabled: enabled && isDesk,
  });
  const source = { provider: search.provider, reason: search.reason };
  const common = { groups, source, query, pages: [] as WorkspaceRecordsResponse[] };

  if (owner === "card") {
    const rows = filterCardSummaries(cards.data ?? [], q).filter((row) =>
      rowMatchesSource(groups.get(cardSummaryKey(row)), search),
    );
    return {
      kind: "card" as const,
      rows,
      entries: rows.map((row) => cardSummaryEntry(row)),
      total: cards.data?.length ?? null,
      ...common,
      ...NO_MORE,
      isPending: enabled && cards.isPending,
      error: cards.error,
    };
  }
  if (isDesk) {
    const rows = filterDeskTable(desk.data?.printings ?? [], search);
    return {
      kind: "desk" as const,
      rows,
      entries: rows.map((row) => deskEntry(row)),
      total: desk.data ? rows.length : null,
      ...common,
      ...NO_MORE,
      isPending: enabled && desk.isPending,
      error: desk.error,
    };
  }
  const pages = records.data?.pages ?? [];
  const rows = pages
    .flatMap((page) => page.rows)
    .filter((row) => rowMatchesSource(groups.get(recordEntry(recordKind, row).key), search));
  return {
    kind: recordKind,
    rows,
    entries: rows.map((row) => recordEntry(recordKind, row)),
    total: records.data ? (pages[0]?.total ?? rows.length) : null,
    ...common,
    pages,
    hasMore: records.hasNextPage,
    isLoadingMore: records.isFetchingNextPage,
    loadMore: () => {
      if (records.hasNextPage && !records.isFetchingNextPage) {
        void records.fetchNextPage();
      }
    },
    isPending: enabled && records.isPending,
    error: records.error,
  };
}

export function useWorkspaceEntries(owner: WorkspaceOwner): {
  view: WorkspaceView;
  listAllowed: boolean;
  entries: ListEntry[];
} {
  const queue = useWorkspaceQueue(owner);
  const listAllowed = ownersForRole(queue.role).includes(owner);
  const records = useWorkspaceRecords(owner, queue.view === "all" && listAllowed);
  return {
    view: queue.view,
    listAllowed,
    entries: queue.view === "all" ? records.entries : queue.entries,
  };
}
