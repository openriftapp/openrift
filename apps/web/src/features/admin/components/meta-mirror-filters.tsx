import type { MetaSource } from "@openrift/shared/contracts/admin/meta-catalog";
import {
  META_CATALOG_DISPLAY_STATUSES,
  PLAYLOLTCG_STATUSES,
  PLAYRIFTBOUND_FORMATS,
  PLAYRIFTBOUND_TOURNAMENT_TYPES,
  TOPDECK_FORMATS,
} from "@openrift/shared/types/enums";
import { Link } from "@tanstack/react-router";

import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { AdminFilterSelect, AdminFilterSwitch } from "@/features/admin/components/admin-filters";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import type { MetaSearch } from "@/features/admin/lib/admin-meta-search";
import type { MirrorRailGroup, MirrorView } from "@/features/admin/lib/meta-mirror-view";
import { mirrorViewId, mirrorViewSearch } from "@/features/admin/lib/meta-mirror-view";
import {
  catalogStatusDisplay,
  PLAYLOLTCG_STATUS_CHOICES,
  PLAYRIFTBOUND_FORMAT_CHOICES,
  PLAYRIFTBOUND_TYPE_CHOICES,
  TOPDECK_FORMAT_CHOICES,
} from "@/features/meta/lib/meta-catalog-display";
import { useSearchUrlSync } from "@/hooks/use-search-url-sync";
import { cn } from "@/lib/utils";

const ANY = "any";

const SEARCH_PLACEHOLDER: Record<MetaSource, string> = {
  uvsgames: "Search event or store",
  playloltcg: "Search event or shop",
  topdeck: "Search event or city",
  playriftbound: "Search event, store or city",
};

const UVSGAMES_STATUS_OPTIONS = [
  { value: ANY, label: "At the source: any" },
  ...META_CATALOG_DISPLAY_STATUSES.map((status) => ({
    value: status,
    label: catalogStatusDisplay(status).label,
  })),
];

function withAny(label: string, choices: readonly { value: string; label: string }[]) {
  return [{ value: ANY, label }, ...choices];
}

function countText(count: number | null): string {
  return count === null ? "n/a" : count.toLocaleString();
}

function RailLink({
  label,
  count,
  view,
  active,
  className,
}: {
  label: string;
  count: number | null;
  view: MirrorView;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      from="/admin/meta"
      to="/admin/meta"
      search={(prev) => ({ ...prev, ...mirrorViewSearch(view), page: undefined })}
      replace
      aria-current={active ? "page" : undefined}
      className={cn(
        "hover:bg-muted/50 flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm",
        active && "bg-muted font-semibold",
        className,
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", !active && "text-muted-foreground")}>
        {countText(count)}
      </span>
    </Link>
  );
}

export function MirrorRail({ groups, view }: { groups: MirrorRailGroup[]; view: MirrorView }) {
  const activeId = mirrorViewId(view);
  return (
    <nav aria-label="Mirror states" className="flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group.item.id} className="flex flex-wrap items-center gap-1">
          <RailLink
            label={group.item.label}
            count={group.item.count}
            view={group.item.view}
            active={group.item.id === activeId}
            className="w-44 font-medium"
          />
          {group.children.map((item) => (
            <RailLink
              key={item.id}
              label={item.label}
              count={item.count}
              view={item.view}
              active={item.id === activeId}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

export function MirrorStateSelect({
  groups,
  view,
  onChange,
}: {
  groups: MirrorRailGroup[];
  view: MirrorView;
  onChange: (view: MirrorView) => void;
}) {
  const items = groups.flatMap((group) => [
    group.item,
    ...group.children.map((child) => ({ ...child, label: `${group.item.label}, ${child.label}` })),
  ]);
  return (
    <AdminFilterSelect
      value={mirrorViewId(view)}
      onChange={(id) => {
        const picked = items.find((item) => item.id === id);
        if (picked !== undefined) {
          onChange(picked.view);
        }
      }}
      options={items.map((item) => ({
        value: item.id,
        label: `${item.label} (${countText(item.count)})`,
      }))}
      label="State"
      className="w-full"
    />
  );
}

export function MirrorFilters({
  source,
  filters,
  applyFilter,
}: {
  source: MetaSource;
  filters: MetaSearch;
  applyFilter: (next: Partial<MetaSearch>) => void;
}) {
  const [minPlayersInput, setMinPlayersInput] = useSearchUrlSync({
    urlValue: filters.minPlayers === undefined ? "" : String(filters.minPlayers),
    onCommit: (value) =>
      applyFilter({ minPlayers: /^\d+$/u.test(value) ? Number(value) : undefined }),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DebouncedSearchInput
        urlValue={filters.q ?? ""}
        onCommit={(value) => applyFilter({ q: value === "" ? undefined : value })}
        placeholder={SEARCH_PLACEHOLDER[source]}
        className="w-full sm:w-64"
      />
      {source === "uvsgames" && (
        <AdminFilterSelect
          value={filters.eventStatus ?? ANY}
          onChange={(value) =>
            applyFilter({
              eventStatus: META_CATALOG_DISPLAY_STATUSES.find((status) => status === value),
            })
          }
          options={UVSGAMES_STATUS_OPTIONS}
          className="w-48"
          label="At the source"
        />
      )}
      {source === "playloltcg" && (
        <AdminFilterSelect
          value={filters.plStatus === undefined ? ANY : String(filters.plStatus)}
          onChange={(value) =>
            applyFilter({
              plStatus: PLAYLOLTCG_STATUSES.find((status) => String(status) === value),
            })
          }
          options={withAny("At the source: any", PLAYLOLTCG_STATUS_CHOICES)}
          className="w-48"
          label="At the source"
        />
      )}
      {source === "topdeck" && (
        <AdminFilterSelect
          value={filters.tdFormat ?? ANY}
          onChange={(value) =>
            applyFilter({ tdFormat: TOPDECK_FORMATS.find((format) => format === value) })
          }
          options={withAny("Any format", TOPDECK_FORMAT_CHOICES)}
          className="w-44"
          label="Format"
        />
      )}
      {source === "playriftbound" && (
        <>
          <AdminFilterSelect
            value={filters.prType ?? ANY}
            onChange={(value) =>
              applyFilter({ prType: PLAYRIFTBOUND_TOURNAMENT_TYPES.find((type) => type === value) })
            }
            options={withAny("Any event type", PLAYRIFTBOUND_TYPE_CHOICES)}
            className="w-48"
            label="Event type"
          />
          <AdminFilterSelect
            value={filters.prFormat ?? ANY}
            onChange={(value) =>
              applyFilter({ prFormat: PLAYRIFTBOUND_FORMATS.find((format) => format === value) })
            }
            options={withAny("Any format", PLAYRIFTBOUND_FORMAT_CHOICES)}
            className="w-44"
            label="Format"
          />
        </>
      )}
      <Input
        type="number"
        min={0}
        value={minPlayersInput}
        onChange={(event) => setMinPlayersInput(event.target.value)}
        placeholder={source === "playriftbound" ? "Min registrations" : "Min players"}
        aria-label={source === "playriftbound" ? "Minimum registrations" : "Minimum players"}
        className="w-44"
      />
      <DatePicker
        value={filters.dateFrom ?? ""}
        onValueChange={(value) => applyFilter({ dateFrom: value })}
        onClear={() => applyFilter({ dateFrom: undefined })}
        placeholder="From"
        className="w-40"
      />
      <DatePicker
        value={filters.dateTo ?? ""}
        onValueChange={(value) => applyFilter({ dateTo: value })}
        onClear={() => applyFilter({ dateTo: undefined })}
        placeholder="To"
        className="w-40"
      />
      {source === "uvsgames" && (
        <AdminFilterSwitch
          id="meta-mirror-decklists"
          checked={filters.decklists ?? false}
          onChange={(checked) => applyFilter({ decklists: checked || undefined })}
        >
          Decklists published
        </AdminFilterSwitch>
      )}
      <AdminFilterSwitch
        id="meta-mirror-missing"
        checked={filters.missing ?? false}
        onChange={(checked) => applyFilter({ missing: checked || undefined })}
      >
        Gone from the source
      </AdminFilterSwitch>
    </div>
  );
}
