import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectCombobox } from "@/features/cards/components/multi-select-combobox";
import type { MetaDeckCostFilterData } from "@/features/meta/components/meta-deck-cost-filter";
import { MetaDeckCostFilter } from "@/features/meta/components/meta-deck-cost-filter";
import { MetaScopeBar } from "@/features/meta/components/meta-scope-bar";
import { useMetaDeckFilters } from "@/features/meta/hooks/use-meta-deck-filters";
import type {
  MetaDeckFilterCounts,
  MetaDeckFilterOptions,
} from "@/features/meta/lib/meta-deck-filters";
import {
  DECK_SCOPE_DEFAULTS,
  hasActiveMetaDeckFilters,
  metaFinishOptions,
} from "@/features/meta/lib/meta-deck-filters";
import type { MetaEra } from "@/features/meta/lib/meta-scope";
import { m } from "@/paraglide/messages.js";

const ANY_FINISH = "";

export function MetaDeckFilterControls({
  options,
  counts,
  eras,
  cost,
}: {
  options: MetaDeckFilterOptions;
  counts: MetaDeckFilterCounts;
  eras: readonly MetaEra[];
  cost: MetaDeckCostFilterData;
}) {
  const filters = useMetaDeckFilters();

  const finishItems: Record<string, string> = { [ANY_FINISH]: m.meta_filter_any_finish() };
  for (const option of metaFinishOptions()) {
    finishItems[String(option.value)] = option.label;
  }

  const extrasActive = hasActiveMetaDeckFilters({
    ...filters,
    valueMin: filters.valueRange.min,
    valueMax: filters.valueRange.max,
  });

  return (
    <MetaScopeBar
      scope={filters.scope}
      setScope={filters.setScope}
      clearScope={filters.clearAllFilters}
      eras={eras}
      countries={options.countries}
      facetDefaults={DECK_SCOPE_DEFAULTS}
      extrasActive={extrasActive}
      extras={
        <>
          {options.legends.length > 1 && (
            <MultiSelectCombobox
              label={m.meta_filter_legend()}
              triggerStyle="button"
              triggerSize="default"
              options={options.legends}
              selected={filters.legends}
              onChange={(next) => filters.setLegends(next)}
              counts={counts.legends}
              searchPlaceholder={m.meta_filter_search_legends()}
            />
          )}

          {options.events.length > 1 && (
            <MultiSelectCombobox
              label={m.meta_filter_event()}
              triggerStyle="button"
              triggerSize="default"
              options={options.events}
              selected={filters.events}
              onChange={(next) => filters.setEvents(next)}
              counts={counts.events}
              searchPlaceholder={m.meta_filter_search_events()}
            />
          )}

          <Select
            value={filters.maxRank === null ? ANY_FINISH : String(filters.maxRank)}
            onValueChange={(value) => {
              const next = (value as string | null) ?? ANY_FINISH;
              filters.setMaxRank(next === ANY_FINISH ? null : Number(next));
            }}
            items={finishItems}
          >
            <SelectTrigger className="w-34" aria-label={m.meta_filter_finish()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(finishItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <MetaDeckCostFilter
            {...cost}
            trigger="control"
            value={{
              maxCost: filters.maxCost,
              valueRange: filters.valueRange,
              includeSideboard: filters.includeSideboard,
            }}
            onMaxCostChange={(next) => filters.setMaxCost(next)}
            onValueRangeChange={(next) => filters.setValueRange(next)}
            onIncludeSideboardChange={(next) => filters.setIncludeSideboard(next)}
            onClear={() => filters.clearCostFilters()}
          />
        </>
      }
    />
  );
}
