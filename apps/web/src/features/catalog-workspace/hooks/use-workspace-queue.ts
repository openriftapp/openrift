import type {
  WorkspaceOwner,
  WorkspaceRecordFilter,
  WorkspaceRecordRow,
  WorkspaceRecordsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { WORKSPACE_RECORD_FILTERS } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardListWhen } from "@/features/admin/hooks/use-admin-card-queries";
import { filterDeskPrintings, sortDeskPrintings } from "@/features/admin/lib/printing-desk-filter";
import { deskPrintingsQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import type { DeskRow, WorkspaceRole } from "@/features/catalog-workspace/lib/owner-items";
import {
  filterCardSummaries,
  filterDeskRows,
  workspaceRole,
} from "@/features/catalog-workspace/lib/owner-items";
import { workspaceRecordsInfiniteQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import type { CardView, WorkspaceSearch } from "@/features/catalog-workspace/lib/workspace-search";
import {
  cardsRouteSearchSchema,
  printingsSearchSchema,
} from "@/features/catalog-workspace/lib/workspace-search";

const RECORDS_PAGE_SIZE = 500;

export const RECORD_FILTERS: Record<
  "face" | "printing" | "desk",
  readonly WorkspaceRecordFilter[]
> = {
  ...WORKSPACE_RECORD_FILTERS,
  desk: ["no-image"],
};

export function recordFilterFor(
  kind: "face" | "printing" | "desk",
  filter: WorkspaceRecordFilter | undefined,
): WorkspaceRecordFilter | undefined {
  return filter !== undefined && RECORD_FILTERS[kind].includes(filter) ? filter : undefined;
}

export function filterDeskTable(
  rows: readonly DeskRow[],
  search: Pick<WorkspaceSearch, "q" | "status" | "deskSort" | "filter" | "set">,
): DeskRow[] {
  const filter = recordFilterFor("desk", search.filter);
  const inSet = rows.filter((row) => search.set === undefined || row.setSlug === search.set);
  const matching = filterDeskPrintings(filterDeskRows(inSet, search.q), {
    query: "",
    status: search.status ?? "any",
  }).filter((row) => filter !== "no-image" || row.imageCount === 0);
  return sortDeskPrintings(matching, search.deskSort ?? "updated");
}

export function useWorkspaceRole(): WorkspaceRole {
  const { data } = useAdminAccess();
  return workspaceRole(data);
}

export function useCardView(): CardView | undefined {
  const raw: Record<string, unknown> = useSearch({ strict: false });
  return cardsRouteSearchSchema.parse(raw).queue;
}

export function useWorkspaceSearch(): WorkspaceSearch {
  const raw: Record<string, unknown> = useSearch({ strict: false });
  return printingsSearchSchema.parse(raw);
}

interface RecordsCommon {
  query: { kind: "face" | "printing"; q?: string; filter?: WorkspaceRecordFilter; set?: string };
  pages: readonly WorkspaceRecordsResponse[];
  total: number | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  isPending: boolean;
  error: Error | null;
}

const NO_MORE = { hasMore: false, isLoadingMore: false, loadMore: () => null };

/** `loadedRows` is what was fetched before the client-side filters, so ticks they hide stay resolvable. */
export type WorkspaceRecordsResult =
  | (RecordsCommon & {
      kind: "card";
      rows: CandidateCardSummaryResponse[];
      loadedRows: readonly CandidateCardSummaryResponse[];
    })
  | (RecordsCommon & {
      kind: "desk";
      rows: DeskRow[];
      loadedRows: readonly DeskRow[];
    })
  | (RecordsCommon & {
      kind: "face" | "printing";
      rows: WorkspaceRecordRow[];
      loadedRows: readonly WorkspaceRecordRow[];
    });

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
    set: search.set,
  } as const;

  const cards = useAdminCardListWhen(enabled && owner === "card");
  const records = useInfiniteQuery({
    ...workspaceRecordsInfiniteQueryOptions({
      ...query,
      limit: RECORDS_PAGE_SIZE,
      sort: search.recordSort,
      direction: search.recordSort === undefined ? undefined : (search.recordDir ?? "asc"),
    }),
    enabled: enabled && owner !== "card" && !isDesk,
  });
  const desk = useQuery({
    ...deskPrintingsQueryOptions(deskMode === "promos" ? "all" : "mine"),
    enabled: enabled && isDesk,
  });
  const common = { query, pages: [] as WorkspaceRecordsResponse[] };

  if (owner === "card") {
    const liveCards = (cards.data ?? []).filter((row) => row.cardSlug !== null);
    return {
      kind: "card" as const,
      rows: filterCardSummaries(liveCards, q, search.set),
      loadedRows: liveCards,
      total: cards.data === undefined ? null : liveCards.length,
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
      loadedRows: desk.data?.printings ?? [],
      total: desk.data ? rows.length : null,
      ...common,
      ...NO_MORE,
      isPending: enabled && desk.isPending,
      error: desk.error,
    };
  }
  const pages = records.data?.pages ?? [];
  const rows = pages.flatMap((page) => page.rows);
  return {
    kind: recordKind,
    rows,
    loadedRows: rows,
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
