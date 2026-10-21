import type {
  WorkspaceOwner,
  WorkspaceRecordRow,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardListWhen } from "@/features/admin/hooks/use-admin-card-queries";
import { deskPrintingsQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import type {
  DeskMode,
  ListEntry,
  WorkspaceRole,
} from "@/features/catalog-workspace/lib/owner-items";
import {
  cardSummaryEntry,
  deskEntry,
  distinctProviders,
  filterCardSummaries,
  filterDeskRows,
  filterGroups,
  groupEntry,
  groupOwnerItems,
  ownersForRole,
  queueStats,
  recordEntry,
  segmentCounts,
  sortGroups,
  visibleQueueItems,
  workspaceRole,
} from "@/features/catalog-workspace/lib/owner-items";
import {
  workspaceQueueQueryOptions,
  workspaceRecordsQueryOptions,
} from "@/features/catalog-workspace/lib/workspace-queries";
import type {
  WorkspaceSearch,
  WorkspaceView,
} from "@/features/catalog-workspace/lib/workspace-search";
import { workspaceSearchSchema } from "@/features/catalog-workspace/lib/workspace-search";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";

export const RECORDS_PAGE_SIZE = 500;

const NO_SKIPS: string[] = [];

export interface WorkspaceSearchState extends WorkspaceSearch {
  desk?: DeskMode;
}

export function useWorkspaceRole(): WorkspaceRole {
  const { data } = useAdminAccess();
  return workspaceRole(data);
}

export function useWorkspaceSearch(): WorkspaceSearchState {
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
  const skipped = useWorkspaceActionsStore((state) => state.skipped[owner] ?? NO_SKIPS);

  const items = query.data ? visibleQueueItems(query.data.items, role) : [];
  const ownerGroups = groupOwnerItems(items.filter((item) => item.owner === owner));
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
    counts: segmentCounts(ownerGroups),
    stats: queueStats(segmentGroups),
    providers: distinctProviders(segmentGroups),
    doneToday: query.data?.doneToday ?? 0,
  };
}

interface RecordsCommon {
  entries: ListEntry[];
  total: number | null;
  truncated: boolean;
  isPending: boolean;
  error: Error | null;
}

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

  const cards = useAdminCardListWhen(enabled && owner === "card");
  const records = useQuery({
    ...workspaceRecordsQueryOptions({
      kind: owner === "face" ? "face" : "printing",
      q,
      limit: RECORDS_PAGE_SIZE,
    }),
    enabled: enabled && owner !== "card" && !isDesk,
  });
  const desk = useQuery({
    ...deskPrintingsQueryOptions(deskMode === "promos" ? "all" : "mine"),
    enabled: enabled && isDesk,
  });

  if (owner === "card") {
    const rows = filterCardSummaries(cards.data ?? [], q);
    return {
      kind: "card" as const,
      rows,
      entries: rows.map((row) => cardSummaryEntry(row)),
      total: cards.data?.length ?? null,
      truncated: false,
      isPending: enabled && cards.isPending,
      error: cards.error,
    };
  }
  if (isDesk) {
    const rows = filterDeskRows(desk.data?.printings ?? [], q);
    return {
      kind: "desk" as const,
      rows,
      entries: rows.map((row) => deskEntry(row)),
      total: desk.data?.printings.length ?? null,
      truncated: false,
      isPending: enabled && desk.isPending,
      error: desk.error,
    };
  }
  const rows = records.data?.rows ?? [];
  const recordOwner = owner === "face" ? "face" : "printing";
  return {
    kind: recordOwner,
    rows,
    entries: rows.map((row) => recordEntry(recordOwner, row)),
    total: records.data ? rows.length : null,
    truncated: (records.data?.nextCursor ?? null) !== null,
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
