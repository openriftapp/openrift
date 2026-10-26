import type {
  WorkspaceOwner,
  WorkspaceRecordFilter,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { workspaceReasonSchema } from "@openrift/shared/contracts/admin/catalog-workspace";
import { Link } from "@tanstack/react-router";

import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { BatchButton } from "@/features/catalog-workspace/components/batch-dialogs";
import type { BatchKind } from "@/features/catalog-workspace/hooks/use-workspace-batch";
import type { WorkspaceSearchState } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import { RECORD_FILTERS } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import type { DeskMode } from "@/features/catalog-workspace/lib/owner-items";
import {
  compactAge,
  REASON_LABELS,
  SORT_LABELS,
} from "@/features/catalog-workspace/lib/owner-items";
import type { WorkspaceView } from "@/features/catalog-workspace/lib/workspace-search";
import {
  DESK_SORTS,
  DESK_STATUSES,
  WORKSPACE_SORTS,
} from "@/features/catalog-workspace/lib/workspace-search";

const ANY = "__any__";

const DESK_SEGMENTS: { value: DeskMode; label: string }[] = [
  { value: "mine", label: "Added by me" },
  { value: "promos", label: "All promos" },
];

const FILTER_LABELS: Record<WorkspaceRecordFilter, string> = {
  promo: "Promos",
  "double-sided": "Double-sided",
  "no-image": "No image",
  mine: "Added by me",
  substitute: "Substitute image",
  shared: "Shared",
};

const DESK_STATUS_ITEMS = [
  { value: ANY, label: "Any status" },
  ...DESK_STATUSES.map((value) => ({
    value,
    label: value === "announced" ? "Announced" : "Released",
  })),
];

const DESK_SORT_LABELS: Record<(typeof DESK_SORTS)[number], string> = {
  code: "By code",
  card: "By card name",
  updated: "Last updated",
  release: "Available from",
};

const BATCH_KINDS: Record<WorkspaceOwner, readonly BatchKind[]> = {
  card: ["trusted-cards"],
  printing: ["trusted-printings", "suggested-listings"],
  face: [],
};

export interface QueueHeaderProps {
  owner: WorkspaceOwner;
  view: WorkspaceView;
  desk: boolean;
  isAdmin: boolean;
  hint?: string;
  counts: { open: number; new: number };
  allCount: number | null;
  search: WorkspaceSearchState;
  providers: string[];
  stats: { decisions: number; oldestAt: string | null };
  doneToday: number;
  onSearchChange: (patch: Partial<WorkspaceSearchState>) => void;
}

function SegmentControl({
  owner,
  view,
  counts,
  allCount,
  onSearchChange,
}: Pick<QueueHeaderProps, "owner" | "view" | "counts" | "allCount" | "onSearchChange">) {
  const segments: { value: WorkspaceView; label: string }[] = [
    { value: "open", label: `Open ${counts.open}` },
    ...(owner === "face" ? [] : [{ value: "new" as const, label: `New ${counts.new}` }]),
    { value: "all", label: allCount === null ? "All" : `All ${allCount.toLocaleString()}` },
  ];
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[view]}
      aria-label="Queue"
      onValueChange={([next]) => {
        const segment = segments.find((option) => option.value === next)?.value;
        if (segment !== undefined) {
          onSearchChange({ segment: segment === "open" ? undefined : segment });
        }
      }}
    >
      {segments.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function DeskSegmentControl({
  search,
  onSearchChange,
}: Pick<QueueHeaderProps, "search" | "onSearchChange">) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[search.desk ?? "mine"]}
      aria-label="Printings"
      onValueChange={([next]) => {
        const mode = DESK_SEGMENTS.find((option) => option.value === next)?.value;
        if (mode !== undefined) {
          onSearchChange({ desk: mode === "mine" ? undefined : mode });
        }
      }}
    >
      {DESK_SEGMENTS.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function TypeFilterChips({
  filters,
  active,
  activeCount,
  onSearchChange,
}: {
  filters: readonly WorkspaceRecordFilter[];
  active: WorkspaceRecordFilter | undefined;
  activeCount: number | null;
  onSearchChange: (patch: Partial<WorkspaceSearchState>) => void;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={active === undefined ? [] : [active]}
      aria-label="Show only"
      onValueChange={([next]) => {
        onSearchChange({ filter: filters.find((filter) => filter === next) });
      }}
    >
      {filters.map((filter) => (
        <ToggleGroupItem key={filter} value={filter}>
          {filter === active && activeCount !== null
            ? `${FILTER_LABELS[filter]} ${activeCount.toLocaleString()}`
            : FILTER_LABELS[filter]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function FilterSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next: string | null) => onChange(next ?? ANY)}
    >
      <SelectTrigger aria-label={label} size="sm" className="min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function QueueHeader({
  owner,
  view,
  desk,
  isAdmin,
  hint,
  counts,
  allCount,
  search,
  providers,
  stats,
  doneToday,
  onSearchChange,
}: QueueHeaderProps) {
  const sortItems = WORKSPACE_SORTS.map((value) => ({
    value,
    label: `Sort: ${SORT_LABELS[value]}`,
  }));
  const providerItems = [
    { value: ANY, label: "Any source" },
    ...[...new Set([...providers, ...(search.provider ? [search.provider] : [])])].map(
      (provider) => ({ value: provider, label: provider }),
    ),
  ];
  const reasonItems = [
    { value: ANY, label: "Any reason" },
    ...workspaceReasonSchema.options.map((reason) => ({
      value: reason,
      label: REASON_LABELS[reason],
    })),
  ];
  const isQueue = view !== "all";
  const filterKind = desk ? "desk" : owner;
  const filters = view === "all" && filterKind !== "card" ? RECORD_FILTERS[filterKind] : [];
  const activeFilter = filters.find((filter) => filter === search.filter);
  const deskSortItems = DESK_SORTS.map((value) => ({
    value,
    label: `Sort: ${DESK_SORT_LABELS[value]}`,
  }));
  const batchKinds = isAdmin && view === "new" ? BATCH_KINDS[owner] : [];

  return (
    <div className="flex flex-col gap-2 border-b px-3 pb-3">
      <DebouncedSearchInput
        urlValue={search.q ?? ""}
        onCommit={(next) => onSearchChange({ q: next === "" ? undefined : next })}
        placeholder="Name or code…"
      />
      {desk ? (
        <DeskSegmentControl search={search} onSearchChange={onSearchChange} />
      ) : (
        <SegmentControl
          owner={owner}
          view={view}
          counts={counts}
          allCount={activeFilter === undefined ? allCount : null}
          onSearchChange={onSearchChange}
        />
      )}
      {filters.length > 0 && (
        <TypeFilterChips
          filters={filters}
          active={activeFilter}
          activeCount={allCount}
          onSearchChange={onSearchChange}
        />
      )}
      {batchKinds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {batchKinds.map((kind) => (
            <BatchButton key={kind} kind={kind} />
          ))}
        </div>
      )}
      {hint !== undefined && <p className="text-muted-foreground text-sm">{hint}</p>}
      {isQueue && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <span>
            <strong>{stats.decisions}</strong>{" "}
            <span className="text-muted-foreground">decisions</span>
          </span>
          {stats.oldestAt !== null && (
            <span>
              <span className="text-muted-foreground">oldest</span>{" "}
              <strong>{compactAge(stats.oldestAt)}</strong>
            </span>
          )}
          <Link to="/admin/workspace/today" className="hover:underline">
            <strong>{doneToday}</strong> <span className="text-muted-foreground">done today ›</span>
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {desk && (
          <>
            <FilterSelect
              label="Status"
              value={search.status ?? ANY}
              items={DESK_STATUS_ITEMS}
              onChange={(next) =>
                onSearchChange({ status: DESK_STATUSES.find((value) => value === next) })
              }
            />
            <FilterSelect
              label="Sort"
              value={search.deskSort ?? "updated"}
              items={deskSortItems}
              onChange={(next) => {
                const deskSort = DESK_SORTS.find((value) => value === next);
                onSearchChange({ deskSort: deskSort === "updated" ? undefined : deskSort });
              }}
            />
          </>
        )}
        {isQueue && (
          <FilterSelect
            label="Sort"
            value={search.order ?? "oldest"}
            items={sortItems}
            onChange={(next) => {
              const order = WORKSPACE_SORTS.find((value) => value === next);
              onSearchChange({ order: order === "oldest" ? undefined : order });
            }}
          />
        )}
        {!desk && (
          <>
            <FilterSelect
              label="Source"
              value={search.provider ?? ANY}
              items={providerItems}
              onChange={(next) => onSearchChange({ provider: next === ANY ? undefined : next })}
            />
            <FilterSelect
              label="Reason"
              value={search.reason ?? ANY}
              items={reasonItems}
              onChange={(next) =>
                onSearchChange({
                  reason: workspaceReasonSchema.options.find((reason) => reason === next),
                })
              }
            />
          </>
        )}
        <span className="text-muted-foreground ml-auto flex items-center gap-1 text-xs">
          <Kbd>J</Kbd>
          <Kbd>K</Kbd>
          move
        </span>
      </div>
    </div>
  );
}
