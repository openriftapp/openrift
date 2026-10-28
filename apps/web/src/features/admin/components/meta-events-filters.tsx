import type { MetaResultsState } from "@openrift/shared/meta-results";
import { META_RESULTS_STATES } from "@openrift/shared/meta-results";
import type { AdminMetaEventList } from "@openrift/shared/types/api/meta";
import { META_EVENT_SOURCE_FILTERS, META_EVENT_TIERS } from "@openrift/shared/types/enums";
import type { MetaEventSourceFilter } from "@openrift/shared/types/enums";
import { Link } from "@tanstack/react-router";

import { DatePicker } from "@/components/ui/date-picker";
import { AdminFilterSelect, AdminFilterSwitch } from "@/features/admin/components/admin-filters";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import type { MetaSearch } from "@/features/admin/lib/admin-meta-search";
import { RESULTS_DISPLAY } from "@/features/admin/lib/meta-mirror-view";
import { META_SOURCE_LABELS } from "@/features/meta/lib/meta-catalog-display";
import { metaEventTierLabels } from "@/features/meta/lib/meta-format";
import { cn } from "@/lib/utils";

const ANY = "any";

type AdminMetaEventListCounts = AdminMetaEventList["counts"];

const SOURCE_LABELS: Record<MetaEventSourceFilter, string> = {
  ...META_SOURCE_LABELS,
  usersubmission: "User submissions",
  manual: "Entered by hand",
};

const SOURCE_OPTIONS = [
  { value: ANY, label: "Any source" },
  ...META_EVENT_SOURCE_FILTERS.map((source) => ({ value: source, label: SOURCE_LABELS[source] })),
];

interface RailEntry {
  id: string;
  label: string;
  count: number;
  search: (prev: MetaSearch) => Partial<MetaSearch>;
}

/** Leaves a provider picked in the Source filter alone; only the rail's own "manual" view is cleared. */
function clearView(prev: MetaSearch): Partial<MetaSearch> {
  return {
    liveResults: undefined,
    incompleteStandings: undefined,
    liveSource: prev.liveSource === "manual" ? undefined : prev.liveSource,
  };
}

function railEntries(counts: AdminMetaEventListCounts): { label: string; entries: RailEntry[] }[] {
  const results = META_RESULTS_STATES.map((state: MetaResultsState) => ({
    id: state,
    label: RESULTS_DISPLAY[state].label,
    count: counts[state],
    search: (prev: MetaSearch) => ({ ...clearView(prev), liveResults: state }),
  }));
  return [
    {
      label: "Results",
      entries: [
        { id: "all", label: "All published", count: counts.total, search: clearView },
        ...results,
      ],
    },
    {
      label: "Gaps",
      entries: [
        {
          id: "short",
          label: "Fewer standings than players",
          count: counts.standingsShort,
          search: (prev: MetaSearch) => ({ ...clearView(prev), incompleteStandings: true }),
        },
        {
          id: "manual",
          label: "Entered by hand",
          count: counts.manual,
          search: (prev: MetaSearch) => ({ ...clearView(prev), liveSource: "manual" }),
        },
      ],
    },
  ];
}

function activeEntry(filters: MetaSearch): string {
  if (filters.incompleteStandings === true) {
    return "short";
  }
  if (filters.liveResults !== undefined) {
    return filters.liveResults;
  }
  return filters.liveSource === "manual" ? "manual" : "all";
}

export function EventsRail({
  filters,
  counts,
}: {
  filters: MetaSearch;
  counts: AdminMetaEventListCounts;
}) {
  const active = activeEntry(filters);
  return (
    <nav aria-label="Published states" className="flex flex-wrap gap-x-8 gap-y-3">
      {railEntries(counts).map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground pr-1 text-xs font-medium tracking-wide uppercase">
            {group.label}
          </span>
          {group.entries.map((entry) => (
            <Link
              key={entry.id}
              from="/admin/meta"
              to="/admin/meta"
              search={(prev) => ({ ...prev, ...entry.search(prev), page: undefined })}
              replace
              aria-current={entry.id === active ? "page" : undefined}
              className={cn(
                "hover:bg-muted/50 flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm",
                entry.id === active && "bg-muted font-semibold",
              )}
            >
              <span>{entry.label}</span>
              <span className={cn("tabular-nums", entry.id !== active && "text-muted-foreground")}>
                {entry.count.toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function EventFilters({
  filters,
  formats,
  applyFilter,
}: {
  filters: MetaSearch;
  formats: { slug: string; label: string }[];
  applyFilter: (next: Partial<MetaSearch>) => void;
}) {
  const tierLabels = metaEventTierLabels();
  const formatOptions = [
    { value: ANY, label: "Any format" },
    ...formats.map((format) => ({ value: format.slug, label: format.label })),
  ];
  const tierOptions = [
    { value: ANY, label: "Any tier" },
    ...META_EVENT_TIERS.map((tier) => ({ value: tier, label: tierLabels[tier] })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DebouncedSearchInput
        urlValue={filters.q ?? ""}
        onCommit={(value) => applyFilter({ q: value === "" ? undefined : value })}
        placeholder="Search event or organizer"
        className="w-full sm:w-64"
      />
      <AdminFilterSelect
        value={filters.liveTier ?? ANY}
        onChange={(value) =>
          applyFilter({ liveTier: META_EVENT_TIERS.find((tier) => tier === value) })
        }
        options={tierOptions}
        label="Tier"
        className="w-40"
      />
      <AdminFilterSelect
        value={filters.liveFormat ?? ANY}
        onChange={(value) => applyFilter({ liveFormat: value === ANY ? undefined : value })}
        options={formatOptions}
        label="Format"
        className="w-44"
      />
      <AdminFilterSelect
        value={filters.liveSource ?? ANY}
        onChange={(value) =>
          applyFilter({ liveSource: META_EVENT_SOURCE_FILTERS.find((source) => source === value) })
        }
        options={SOURCE_OPTIONS}
        label="Source"
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
      <AdminFilterSwitch
        id="meta-events-has-decks"
        checked={filters.hasDecks ?? false}
        onChange={(checked) => applyFilter({ hasDecks: checked || undefined })}
      >
        Has decklists
      </AdminFilterSwitch>
    </div>
  );
}
