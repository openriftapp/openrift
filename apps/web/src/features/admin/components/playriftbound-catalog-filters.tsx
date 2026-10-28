import type { MetaCatalogTriage } from "@openrift/shared/contracts/admin/meta-catalog";
import { pluralize } from "@openrift/shared/strings";
import {
  PLAYRIFTBOUND_FORMATS,
  PLAYRIFTBOUND_TOURNAMENT_TYPES,
} from "@openrift/shared/types/enums";

import { PageDescription } from "@/components/layout/page-top-bar";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { AdminFilterSelect, AdminFilterSwitch } from "@/features/admin/components/admin-filters";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { CatalogSourceSelect } from "@/features/admin/components/meta-catalog-shared";
import type { TriageCounts } from "@/features/admin/components/meta-triage-filter";
import {
  ANY,
  BucketFilterChip,
  TriageFilterSelect,
} from "@/features/admin/components/meta-triage-filter";
import type { MetaSearch } from "@/features/admin/lib/admin-meta-search";
import {
  PLAYRIFTBOUND_FORMAT_CHOICES,
  PLAYRIFTBOUND_TYPE_CHOICES,
} from "@/features/meta/lib/meta-catalog-display";
import { useSearchUrlSync } from "@/hooks/use-search-url-sync";

const TYPE_OPTIONS = [{ value: ANY, label: "Any type" }, ...PLAYRIFTBOUND_TYPE_CHOICES];
const FORMAT_OPTIONS = [{ value: ANY, label: "Any format" }, ...PLAYRIFTBOUND_FORMAT_CHOICES];

function typeParam(value: string): MetaSearch["prType"] {
  return PLAYRIFTBOUND_TOURNAMENT_TYPES.find((type) => type === value);
}

function formatParam(value: string): MetaSearch["prFormat"] {
  return PLAYRIFTBOUND_FORMATS.find((format) => format === value);
}

export function PlayriftboundCatalogFilters({
  filters,
  triage,
  counts,
  total,
  applyFilter,
}: {
  filters: MetaSearch;
  triage: MetaCatalogTriage | "any";
  counts?: TriageCounts;
  total: number;
  applyFilter: (next: Partial<MetaSearch>) => void;
}) {
  const [minPlayersInput, setMinPlayersInput] = useSearchUrlSync({
    urlValue: filters.minPlayers === undefined ? "" : String(filters.minPlayers),
    onCommit: (value) =>
      applyFilter({ minPlayers: /^\d+$/u.test(value) ? Number(value) : undefined }),
  });

  return (
    <div className="space-y-3">
      <PageDescription>
        Every event Riot&apos;s own event platform lists around the stores the sync knows, as of the
        last sync. Accept an event to publish it on /meta: this creates its public event page and
        fetches its standings and pairings. The platform publishes no decklists.
      </PageDescription>
      <div className="flex flex-wrap items-center gap-2">
        <CatalogSourceSelect source={filters.source ?? "uvsgames"} applyFilter={applyFilter} />
        <DebouncedSearchInput
          urlValue={filters.q ?? ""}
          onCommit={(value) => applyFilter({ q: value === "" ? undefined : value })}
          placeholder="Search event, store or city"
          className="w-64"
        />
        <TriageFilterSelect
          selected={triage}
          counts={counts}
          onChange={(next) => applyFilter({ triage: next })}
        />
        {filters.bucket !== undefined && (
          <BucketFilterChip
            bucket={filters.bucket}
            onRemove={() => applyFilter({ bucket: undefined })}
          />
        )}
        <AdminFilterSelect
          value={filters.prType ?? ANY}
          onChange={(value) => applyFilter({ prType: typeParam(value) })}
          options={TYPE_OPTIONS}
          className="w-44"
          label="Event type"
        />
        <AdminFilterSelect
          value={filters.prFormat ?? ANY}
          onChange={(value) => applyFilter({ prFormat: formatParam(value) })}
          options={FORMAT_OPTIONS}
          className="w-36"
          label="Format"
        />
        <Input
          type="number"
          min={0}
          value={minPlayersInput}
          onChange={(event) => setMinPlayersInput(event.target.value)}
          placeholder="Min players"
          aria-label="Minimum players"
          className="w-32"
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
          id="playriftbound-catalog-missing"
          checked={filters.missing ?? false}
          onChange={(checked) => applyFilter({ missing: checked || undefined })}
        >
          Gone from the listing
        </AdminFilterSwitch>
        <AdminFilterSwitch
          id="playriftbound-catalog-awaiting"
          checked={filters.awaitingResults ?? false}
          onChange={(checked) => applyFilter({ awaitingResults: checked || undefined })}
        >
          Awaiting results
        </AdminFilterSwitch>
      </div>
      <p className="text-muted-foreground">
        {total} matching {pluralize(total, "event")}.
      </p>
    </div>
  );
}
